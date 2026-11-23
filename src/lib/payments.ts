import "server-only";
import { eq, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import type { Currency } from "./money";
import { formatMoney } from "./money";
import { OutOfStockError, isFirstPaidOrder, lockOrder, logOrderEvent, reserveStock, stockNeeds } from "./checkout";
import { pushToAdmin } from "./push";
import { sendEmail, escapeHtml, APP_URL } from "./email";
import { REFERRAL_REWARD } from "./constants";
import { randomCode } from "./utils";
import { PROVIDER_NAME, type Provider, type VerifiedTx } from "./gateways";

export type SettleResult = { status: "paid" | "failed" | "pending" | "mismatch" | "unknown"; orderNumber?: string };

/**
 * Applies a VERIFIED gateway transaction (from `verifyPayment`) to our records, idempotently, under row locks.
 * The order is marked paid only if reference, gateway, status, currency and exact amount all match.
 */
export async function settlePayment(tx: VerifiedTx): Promise<SettleResult> {
  const alerts: (() => Promise<void>)[] = [];
  const result = await db.transaction(async (t): Promise<SettleResult> => {
    const [pay] = await t.select().from(s.payments).where(eq(s.payments.reference, tx.reference)).for("update");
    if (!pay || pay.provider !== tx.provider) return { status: "unknown" }; // a reference only counts on the gateway it was opened with
    const gw = PROVIDER_NAME[pay.provider as Provider];
    const order = (await lockOrder(t, pay.orderId))!;
    const done = { orderNumber: order.number };

    if (pay.status === "success") return { status: "paid", ...done };
    if (tx.status !== "successful") {
      if (tx.status === "failed") await t.update(s.payments).set({ status: "failed", raw: tx }).where(eq(s.payments.id, pay.id));
      return { status: tx.status === "failed" ? "failed" : "pending", ...done };
    }

    const matches = tx.currency === pay.currency && Number.isInteger(tx.amount) && tx.amount === pay.amount
      && pay.amount === order.total && pay.currency === order.currency;
    if (!matches) {
      await t.update(s.payments).set({ status: "failed", raw: tx }).where(eq(s.payments.id, pay.id));
      await t.update(s.orders).set({ note: `Payment mismatch on ${tx.reference}: got ${tx.amount / 100} ${tx.currency}` }).where(eq(s.orders.id, order.id));
      await logOrderEvent(t, order.id, order.status, `Payment mismatch: received ${tx.amount / 100} ${tx.currency} via ${gw}, not marked paid`);
      alerts.push(() => alertAdmin(`Payment mismatch · ${order.number}`, `${gw} reported ${tx.amount / 100} ${tx.currency} for reference ${tx.reference}; expected ${formatMoney(order.total, order.currency as Currency)}. Order NOT marked paid.`));
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
      await t.update(s.orders).set({ note: `Duplicate payment received (${tx.reference}); refund it in ${gw}` }).where(eq(s.orders.id, order.id));
      await logOrderEvent(t, order.id, order.status, `Duplicate payment received: refund it in ${gw}`);
      alerts.push(() => alertAdmin(`Duplicate payment · ${order.number}`, `A second successful payment (${tx.reference}) arrived for an order that was already ${order.status}. Refund it in ${gw}.`));
      return { status: "paid", ...done };
    }

    if (becamePaid) {
      await t.update(s.orders).set({ status: "paid", paidAt: new Date() }).where(eq(s.orders.id, order.id));
      await logOrderEvent(t, order.id, "paid", `${order.status === "cancelled" ? "Payment confirmed after the payment window" : "Payment confirmed"} (${gw})`);
      if (order.couponId) {
        const [c] = await t.update(s.coupons).set({ redemptions: sql`${s.coupons.redemptions} + 1` }).where(eq(s.coupons.id, order.couponId))
          .returning({ code: s.coupons.code, redemptions: s.coupons.redemptions, max: s.coupons.maxRedemptions });
        if (c?.max != null && c.redemptions > c.max) { // only possible for payments after expiry; the customer already paid, so flag it
          await logOrderEvent(t, order.id, "paid", `Code ${c.code} is now over its limit (${c.redemptions}/${c.max})`);
          alerts.push(() => alertAdmin(`Code over its limit · ${order.number}`, `${c.code} has been redeemed ${c.redemptions} times (limit ${c.max}).`, `/admin/orders/${order.id}`));
        }
      }
      // Referral rewards only for the referred person's FIRST paid order (re-checked now that money has arrived).
      if (order.referrerId && !(await isFirstPaidOrder(t, order))) {
        await logOrderEvent(t, order.id, "paid", "Referral reward not issued: not the buyer’s first order");
      } else if (order.referrerId) {
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

/** Emails the admin (full details) and pushes to their devices (no customer details: lock screens are visible to others). */
export async function alertAdmin(subject: string, text: string, path = "/admin/orders", pushBody = "Open the dashboard for details.") {
  await Promise.allSettled([
    process.env.ADMIN_EMAIL && sendEmail(process.env.ADMIN_EMAIL, subject, subject, `<p>${escapeHtml(text)}</p>`, { label: "Open dashboard", url: `${APP_URL}${path}` }),
    pushToAdmin({ title: subject, body: pushBody, url: path }),
  ]);
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
    alertAdmin(`New order ${o.number} · ${formatMoney(o.total, c)}`, `${o.email} paid ${formatMoney(o.total, c)} for ${items.length} item(s). Ship to ${o.shippingAddress.city}, ${o.shippingAddress.state}, ${o.shippingAddress.country}.`, `/admin/orders/${o.id}`,
      `${items.reduce((n, i) => n + i.quantity, 0)} item(s) · tap to view and ship`),
  ]);
}

