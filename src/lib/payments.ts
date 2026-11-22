import "server-only";
import { timingSafeEqual } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import type { Currency } from "./money";
import { formatMoney } from "./money";
import { OutOfStockError, lockOrder, reserveStock, stockNeeds } from "./checkout";
import { sendEmail, escapeHtml, APP_URL } from "./email";
import { REFERRAL_REWARD } from "./constants";
import { randomCode } from "./utils";

const FLW = "https://api.flutterwave.com/v3";
const flwHeaders = () => ({ Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`, "Content-Type": "application/json" });

export type FlwTransaction = { id: number; tx_ref: string; status: string; amount: number; currency: string };

/** Creates a Flutterwave hosted checkout link. Amount is in minor units. */
export async function createPaymentLink(p: {
  reference: string; amount: number; currency: Currency; email: string; name: string; phone: string;
}) {
  if (!process.env.FLW_SECRET_KEY) throw new Error("Payments are not configured");
  const res = await fetch(`${FLW}/payments`, {
    method: "POST",
    headers: flwHeaders(),
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      tx_ref: p.reference,
      amount: p.amount / 100,
      currency: p.currency,
      redirect_url: `${APP_URL}/checkout/complete`,
      payment_options: p.currency === "NGN" ? "card,banktransfer,ussd" : "card",
      session_duration: 60,
      max_retry_attempt: 5,
      customer: { email: p.email, name: p.name, phonenumber: p.phone },
      customizations: { title: "Melaré", description: "Skin, but rarer.", logo: `${APP_URL}/icon-512.png` },
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.status !== "success" || typeof json?.data?.link !== "string") {
    throw new Error(json?.message ?? `Flutterwave error ${res.status}`);
  }
  return json.data.link as string;
}

/** Server-to-server lookup by OUR reference. Never trust redirect query params. */
export async function verifyByReference(reference: string): Promise<FlwTransaction | null> {
  if (!process.env.FLW_SECRET_KEY) return null;
  const res = await fetch(`${FLW}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`, {
    headers: flwHeaders(), cache: "no-store", signal: AbortSignal.timeout(15000),
  });
  const json = await res.json().catch(() => null);
  if (json?.status !== "success" || !json.data) return null;
  const d = json.data;
  return { id: Number(d.id), tx_ref: String(d.tx_ref), status: String(d.status), amount: Number(d.amount), currency: String(d.currency) };
}

export function isValidWebhook(h: Headers) {
  const got = Buffer.from(h.get("verif-hash") ?? "");
  const want = Buffer.from(process.env.FLW_WEBHOOK_HASH ?? "");
  return want.length > 0 && got.length === want.length && timingSafeEqual(got, want);
}

export type SettleResult = { status: "paid" | "failed" | "pending" | "mismatch" | "unknown"; orderNumber?: string };

/**
 * Applies a VERIFIED Flutterwave transaction to our records, idempotently, under row locks.
 * The order is marked paid only if reference, status, currency and exact amount all match.
 */
export async function settlePayment(tx: FlwTransaction): Promise<SettleResult> {
  const alerts: (() => Promise<void>)[] = [];
  const result = await db.transaction(async (t): Promise<SettleResult> => {
    const [pay] = await t.select().from(s.payments).where(eq(s.payments.reference, tx.tx_ref)).for("update");
    if (!pay) return { status: "unknown" };
    const order = (await lockOrder(t, pay.orderId))!;
    const done = { orderNumber: order.number };

    if (pay.status === "success") return { status: "paid", ...done };
    if (tx.status !== "successful") {
      if (tx.status === "failed") await t.update(s.payments).set({ status: "failed", raw: tx }).where(eq(s.payments.id, pay.id));
      return { status: tx.status === "failed" ? "failed" : "pending", ...done };
    }

    const matches = tx.currency === pay.currency && Math.round(tx.amount * 100) === pay.amount
      && pay.amount === order.total && pay.currency === order.currency;
    if (!matches) {
      await t.update(s.payments).set({ status: "failed", raw: tx }).where(eq(s.payments.id, pay.id));
      await t.update(s.orders).set({ note: `Payment mismatch on ${tx.tx_ref}: got ${tx.amount} ${tx.currency}` }).where(eq(s.orders.id, order.id));
      alerts.push(() => alertAdmin(`Payment mismatch · ${order.number}`, `Flutterwave reported ${tx.amount} ${tx.currency} for reference ${tx.tx_ref}; expected ${formatMoney(order.total, order.currency as Currency)}. Order NOT marked paid.`));
      return { status: "mismatch", ...done };
    }

    await t.update(s.payments).set({ status: "success", transactionId: String(tx.id), raw: tx }).where(eq(s.payments.id, pay.id));

    let becamePaid = false;
    if (order.status === "pending") {
      becamePaid = true;
    } else if (order.status === "cancelled" && !order.stockReserved && order.note === "Payment window expired") {
      // Paid after the reservation lapsed: try to take the stock again.
      const items = await t.select().from(s.orderItems).where(eq(s.orderItems.orderId, order.id));
      try {
        await t.transaction((sp) => reserveStock(sp, stockNeeds(items.map((i) => ({ quantity: 1, stock: i.stock })))));
        await t.update(s.orders).set({ stockReserved: true, note: null }).where(eq(s.orders.id, order.id));
      } catch (e) {
        if (!(e instanceof OutOfStockError)) throw e;
        await t.update(s.orders).set({ note: "Paid after expiry but stock ran out: restock or refund" }).where(eq(s.orders.id, order.id));
        alerts.push(() => alertAdmin(`Action needed · ${order.number}`, "This order was paid after its payment window and some items are out of stock. Restock or refund the customer."));
      }
      becamePaid = true;
    } else {
      await t.update(s.orders).set({ note: `Duplicate payment received (${tx.tx_ref}); refund it` }).where(eq(s.orders.id, order.id));
      alerts.push(() => alertAdmin(`Duplicate payment · ${order.number}`, `A second successful payment (${tx.tx_ref}) arrived for an order that was already ${order.status}. Refund it in Flutterwave.`));
      return { status: "paid", ...done };
    }

    if (becamePaid) {
      await t.update(s.orders).set({ status: "paid", paidAt: new Date() }).where(eq(s.orders.id, order.id));
      if (order.couponId) {
        await t.update(s.coupons).set({ redemptions: sql`${s.coupons.redemptions} + 1` }).where(eq(s.coupons.id, order.couponId));
      }
      if (order.referrerId) {
        const code = `THANKS-${randomCode(6)}`;
        await t.insert(s.coupons).values({
          code, userId: order.referrerId, amountOffNgn: REFERRAL_REWARD.NGN, amountOffUsd: REFERRAL_REWARD.USD, maxRedemptions: 1,
        });
        const [ref] = await t.select({ email: s.user.email, name: s.user.name }).from(s.user).where(eq(s.user.id, order.referrerId));
        if (ref) alerts.push(() => sendEmail(ref.email, "You earned a reward · Melaré", "A friend just shopped with your code",
          `<p>Thank you, ${escapeHtml(ref.name)}! Here’s your reward code, usable once on your account: <strong>${code}</strong> (${formatMoney(REFERRAL_REWARD.NGN, "NGN")} / ${formatMoney(REFERRAL_REWARD.USD, "USD")} off).</p>`,
          { label: "Shop now", url: `${APP_URL}/shop` }));
      }
      if (order.cartId) await t.delete(s.cartItems).where(eq(s.cartItems.cartId, order.cartId));
      alerts.push(() => sendOrderEmails(order.id));
    }
    return { status: "paid", ...done };
  });
  await Promise.allSettled(alerts.map((a) => a()));
  return result;
}

export async function alertAdmin(subject: string, text: string) {
  if (process.env.ADMIN_EMAIL) await sendEmail(process.env.ADMIN_EMAIL, subject, subject, `<p>${escapeHtml(text)}</p>`, { label: "Open dashboard", url: `${APP_URL}/admin/orders` });
}

async function sendOrderEmails(orderId: string) {
  const [o] = await db.select().from(s.orders).where(eq(s.orders.id, orderId));
  const items = await db.select().from(s.orderItems).where(eq(s.orderItems.orderId, orderId));
  const c = o.currency as Currency;
  const rows = items.map((i) => `<tr><td style="padding:6px 0">${escapeHtml(i.name)} · ${escapeHtml(i.label)} × ${i.quantity}</td><td align="right">${formatMoney(i.unitPrice * i.quantity, c)}</td></tr>`).join("");
  const table = `<table width="100%" style="font-size:14px">${rows}
<tr><td style="padding-top:10px;color:#6B5045">Shipping</td><td align="right" style="padding-top:10px">${formatMoney(o.shippingFee, c)}</td></tr>
${o.discount ? `<tr><td style="color:#6B5045">Discount</td><td align="right">−${formatMoney(o.discount, c)}</td></tr>` : ""}
<tr><td style="padding-top:6px"><strong>Total</strong></td><td align="right"><strong>${formatMoney(o.total, c)}</strong></td></tr></table>`;
  const url = o.userId ? `${APP_URL}/account/orders/${o.number}` : `${APP_URL}/track?number=${o.number}`;
  await Promise.allSettled([
    sendEmail(o.email, `Order ${o.number} confirmed · Melaré`, "Thank you for your order",
      `<p>We’ve received your payment and we’re getting your order ready. Order number: <strong>${o.number}</strong>.</p>${table}<p style="color:#6B5045">Estimated delivery: ${escapeHtml(o.shippingZone)}.</p>`,
      { label: "View order", url }),
    alertAdmin(`New order ${o.number} · ${formatMoney(o.total, c)}`, `${o.email} paid ${formatMoney(o.total, c)} for ${items.length} item(s). Ship to ${o.shippingAddress.city}, ${o.shippingAddress.state}, ${o.shippingAddress.country}.`),
  ]);
}

