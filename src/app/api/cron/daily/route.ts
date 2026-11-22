import { timingSafeEqual } from "node:crypto";
import { and, eq, gt, inArray, isNotNull, isNull, lt, notInArray, or, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { expireStaleOrders } from "@/lib/checkout";
import { getCartLines } from "@/lib/cart";
import { sendEmail, escapeHtml, APP_URL } from "@/lib/email";

const DAY = 86_400_000;

function authorized(req: Request) {
  const got = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${process.env.CRON_SECRET ?? ""}`);
  return !!process.env.CRON_SECRET && got.length === want.length && timingSafeEqual(got, want);
}

// Vercel Cron (vercel.json) calls this daily with `Authorization: Bearer $CRON_SECRET`.
export async function GET(req: Request) {
  if (!authorized(req)) return new Response("Unauthorized", { status: 401 });
  const now = Date.now();
  const report = { expired: await expireStaleOrders(), abandoned: 0, reorder: 0 };

  // Abandoned bags: idle 4h–7d, with an email, max 2 reminders, ≥24h apart, no order since.
  const carts = await db.select().from(s.carts).where(and(
    isNotNull(s.carts.email), lt(s.carts.updatedAt, new Date(now - 4 * 3_600_000)), gt(s.carts.updatedAt, new Date(now - 7 * DAY)),
    lt(s.carts.remindersSent, 2), or(isNull(s.carts.lastRemindedAt), lt(s.carts.lastRemindedAt, new Date(now - DAY))),
  )).limit(200);
  for (const c of carts) {
    const lines = await getCartLines(c.id);
    if (!lines.some((l) => l.maxQty > 0)) continue;
    const [recent] = await db.select({ id: s.orders.id }).from(s.orders)
      .where(and(eq(s.orders.cartId, c.id), gt(s.orders.createdAt, c.updatedAt), notInArray(s.orders.status, ["pending", "cancelled"]))).limit(1);
    if (recent) continue;
    await sendEmail(c.email!, "You left something beautiful behind", "Your bag is waiting",
      `<p>Your Melaré favourites are still in your bag:</p><ul>${lines.map((l) => `<li>${escapeHtml(l.name)} · ${escapeHtml(l.label)}</li>`).join("")}</ul><p>Popular items sell out, so complete your order while they’re in stock.</p>`,
      { label: "Return to my bag", url: `${APP_URL}/cart` });
    await db.update(s.carts).set({ remindersSent: sql`${s.carts.remindersSent} + 1`, lastRemindedAt: new Date() }).where(eq(s.carts.id, c.id));
    report.abandoned++;
  }

  // Reorder reminders: ~10 days before a product typically runs out.
  const due = await db.select({ itemId: s.orderItems.id, email: s.orders.email, name: s.orderItems.name, slug: s.products.slug })
    .from(s.orderItems).innerJoin(s.orders, eq(s.orders.id, s.orderItems.orderId)).innerJoin(s.products, eq(s.products.id, s.orderItems.productId))
    .where(and(
      isNull(s.orderItems.reminderSentAt), inArray(s.orders.status, ["paid", "processing", "shipped", "delivered"]), isNotNull(s.products.daysSupply),
      sql`${s.orders.paidAt} + make_interval(days => ${s.products.daysSupply} - 10) <= now()`,
      sql`${s.orders.paidAt} > now() - interval '400 days'`,
    )).limit(200);
  for (const d of due) {
    await sendEmail(d.email, `Running low on ${d.name}?`, "Time for a top-up?",
      `<p>Based on your last order, your <strong>${escapeHtml(d.name)}</strong> is probably running low. Reorder now so your routine never skips a day.</p>`,
      { label: "Reorder", url: `${APP_URL}/products/${d.slug}` });
    await db.update(s.orderItems).set({ reminderSentAt: new Date() }).where(eq(s.orderItems.id, d.itemId));
    report.reorder++;
  }

  // Housekeeping
  await db.delete(s.throttle).where(lt(s.throttle.resetAt, new Date(now - DAY)));
  await db.delete(s.carts).where(and(isNull(s.carts.userId), lt(s.carts.updatedAt, new Date(now - 90 * DAY))));
  return Response.json(report);
}
