import "server-only";
import { and, asc, eq, inArray, lt, notInArray, or, sql } from "drizzle-orm";
import { db, schema as s, type Tx } from "@/db";
import type { CartLine } from "./cart";
import { priceIn, type Currency } from "./money";
import { REFERRAL_MIN_SUBTOTAL, REFERRAL_REWARD } from "./constants";

const UNIT = 100; // one naira / one dollar in minor units
const PAID = ["paid", "processing", "shipped", "delivered"] as const;

/** Who is buying. Codes need a signed-in (verified) account; phone is known at order time. */
export type Buyer = { userId: string | null; email: string; phone?: string };

/** One person = one identity: Gmail ignores dots and +tags; everyone ignores +tags. */
export function canonicalEmail(email: string) {
  const [local = "", domain = ""] = email.trim().toLowerCase().split("@");
  const base = local.replace(/\+.*$/, "");
  return domain === "gmail.com" || domain === "googlemail.com" ? `${base.replace(/\./g, "")}@gmail.com` : `${base}@${domain}`;
}
export const phoneKey = (phone: string | null | undefined) => (phone ?? "").replace(/\D/g, "").slice(-10); // local part, any prefix
const canonSql = (col: unknown) => sql`(case when split_part(lower(${col}), '@', 2) in ('gmail.com', 'googlemail.com')
  then replace(regexp_replace(split_part(lower(${col}), '@', 1), '\\+.*$', ''), '.', '') || '@gmail.com'
  else regexp_replace(split_part(lower(${col}), '@', 1), '\\+.*$', '') || '@' || split_part(lower(${col}), '@', 2) end)`;
const phoneSql = sql`right(regexp_replace(${s.orders.shippingAddress}->>'phone', '\\D', '', 'g'), 10)`;

/** Orders belonging to this person: same account, same canonical email, or same phone. */
function samePerson(buyer: Buyer) {
  const phone = phoneKey(buyer.phone);
  return or(
    buyer.userId ? eq(s.orders.userId, buyer.userId) : undefined,
    sql`${canonSql(s.orders.email)} = ${canonicalEmail(buyer.email)}`,
    phone.length >= 7 ? sql`${phoneSql} = ${phone}` : undefined,
  )!;
}

/** Serialises code use per person (canonical email + phone) so parallel checkouts can't reuse a code. */
export async function lockBuyer(tx: Tx, buyer: Buyer) {
  const keys = [`buyer:${canonicalEmail(buyer.email)}`, ...(phoneKey(buyer.phone).length >= 7 ? [`phone:${phoneKey(buyer.phone)}`] : [])].sort();
  for (const k of keys) await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${k}))`);
}

export const CODE_INVALID = "This code can’t be used on this order. Some codes need a minimum spend or can only be used once.";
export type Applied =
  | { kind: "coupon"; couponId: string; code: string; discount: number }
  | { kind: "referral"; referrerId: string; code: string; discount: number };

type Executor = typeof db | Tx;

export const lineUnit = (l: CartLine, c: Currency) => (c === "NGN" ? l.unitNgn : l.unitUsd);
export const subtotalOf = (lines: CartLine[], c: Currency) => lines.reduce((t, l) => t + lineUnit(l, c) * l.quantity, 0);

/** Shipping zone: exact country+state, then country, then rest-of-world ("*"). */
export async function zoneFor(country: string, state: string | undefined, ex: Executor = db) {
  const zones = await ex.select().from(s.shippingZones).orderBy(asc(s.shippingZones.position));
  return (
    zones.find((z) => z.country === country && z.state && z.state.toLowerCase() === state?.toLowerCase()) ??
    zones.find((z) => z.country === country && !z.state) ??
    zones.find((z) => z.country === "*") ??
    null
  );
}

export function shippingFee(zone: typeof s.shippingZones.$inferSelect, currency: Currency, merchandise: number) {
  const free = currency === "NGN" ? zone.freeOverNgn : zone.freeOverUsd;
  if (free != null && merchandise >= free) return 0;
  return priceIn({ priceNgn: zone.feeNgn, priceUsd: zone.feeUsd }, currency);
}

/** Any order (paid OR still awaiting payment) by this person. Pending orders count, so parallel checkouts can't stack first-order perks. */
async function hasOrdered(buyer: Buyer, ex: Executor) {
  const [row] = await ex.select({ id: s.orders.id }).from(s.orders).where(and(samePerson(buyer), notInArray(s.orders.status, ["cancelled"]))).limit(1);
  return !!row;
}

/**
 * Validates a coupon or referral code for this buyer and subtotal.
 * Codes need a signed-in account; once per person (account, canonical email or phone), pending orders included.
 * Every failure returns the same message (no oracle for guessing codes). Pass `lock` inside the order transaction.
 */
export async function applyCode(rawCode: string, buyer: Buyer, currency: Currency, subtotal: number, ex: Executor = db, lock = false):
  Promise<{ ok: true; applied: Applied } | { ok: false; error: string }> {
  if (!buyer.userId) return { ok: false, error: "Sign in to use a promo or referral code." };
  const code = rawCode.trim().toUpperCase();
  const invalid = { ok: false as const, error: CODE_INVALID };
  if (!/^[A-Z0-9-]{3,32}$/.test(code)) return invalid;
  const cap = (d: number) => Math.max(0, Math.min(d, subtotal - UNIT));

  const q = ex.select().from(s.coupons).where(eq(s.coupons.code, code));
  const [c] = lock ? await q.for("update") : await q;
  if (c) {
    if (!c.active || (c.expiresAt && c.expiresAt < new Date())) return invalid;
    if (c.userId && c.userId !== buyer.userId) return invalid;
    const min = currency === "NGN" ? c.minSubtotalNgn : c.minSubtotalUsd;
    if (min != null && subtotal < min) return invalid;
    if (c.maxRedemptions != null) {
      const [{ open }] = await ex.select({ open: sql<number>`count(*)::int` }).from(s.orders)
        .where(and(eq(s.orders.couponId, c.id), eq(s.orders.status, "pending"), sql`${s.orders.expiresAt} > now()`));
      if (c.redemptions + open >= c.maxRedemptions) return invalid; // unpaid orders hold a redemption
    }
    const [used] = await ex.select({ id: s.orders.id }).from(s.orders)
      .where(and(eq(s.orders.couponId, c.id), samePerson(buyer), notInArray(s.orders.status, ["cancelled"]))).limit(1);
    if (used) return invalid;
    const raw = c.percentOff != null
      ? Math.floor((subtotal * c.percentOff) / 100 / UNIT) * UNIT
      : (currency === "NGN" ? c.amountOffNgn! : c.amountOffUsd!);
    return { ok: true, applied: { kind: "coupon", couponId: c.id, code, discount: cap(raw) } };
  }

  const [referrer] = await ex.select({ id: s.user.id, email: s.user.email, phone: s.user.phone }).from(s.user).where(eq(s.user.referralCode, code));
  if (referrer) {
    if (subtotal < REFERRAL_MIN_SUBTOTAL[currency]) return invalid;
    const buyerPhone = phoneKey(buyer.phone);
    const referrerPhones = [referrer.phone, ...(await ex.select({ phone: s.addresses.phone }).from(s.addresses).where(eq(s.addresses.userId, referrer.id))).map((a) => a.phone)].map(phoneKey);
    const self = referrer.id === buyer.userId || canonicalEmail(referrer.email) === canonicalEmail(buyer.email) || (buyerPhone.length >= 7 && referrerPhones.includes(buyerPhone));
    if (self || (await hasOrdered(buyer, ex))) return invalid;
    return { ok: true, applied: { kind: "referral", referrerId: referrer.id, code, discount: cap(REFERRAL_REWARD[currency]) } };
  }
  return invalid;
}

/** Re-checked when the money arrives: referral rewards only for the buyer's first paid order. */
export async function isFirstPaidOrder(ex: Executor, order: { id: string; userId: string | null; email: string; shippingAddress: { phone: string } }) {
  const [other] = await ex.select({ id: s.orders.id }).from(s.orders).where(and(
    samePerson({ userId: order.userId, email: order.email, phone: order.shippingAddress.phone }),
    inArray(s.orders.status, [...PAID]), sql`${s.orders.id} <> ${order.id}`,
  )).limit(1);
  return !other;
}

/** Stock hoarding guard: unpaid, unexpired orders this shopper (person or cart) already holds. */
export async function openOrders(ex: Executor, buyer: Buyer, cartId: string) {
  const [{ n }] = await ex.select({ n: sql<number>`count(*)::int` }).from(s.orders).where(and(
    eq(s.orders.status, "pending"), sql`${s.orders.expiresAt} > now()`, or(samePerson(buyer), eq(s.orders.cartId, cartId)),
  ));
  return n;
}

/** Orders delivered in Nigeria are charged in naira; everywhere else in dollars (no currency arbitrage). */
export const currencyFor = (country: string): Currency => (country === "NG" ? "NGN" : "USD");

/** Aggregate per-variant quantities consumed by these lines. */
export function stockNeeds(lines: { quantity: number; stock: { variantId: string; quantity: number }[] }[]) {
  const need = new Map<string, number>();
  for (const l of lines) for (const st of l.stock) need.set(st.variantId, (need.get(st.variantId) ?? 0) + st.quantity * l.quantity);
  return need;
}

export class OutOfStockError extends Error {}

/** Atomically decrements stock; throws (rolling back the transaction) if any variant is short. */
export async function reserveStock(tx: Tx, need: Map<string, number>) {
  for (const [variantId, qty] of [...need].sort(([a], [b]) => a.localeCompare(b))) { // fixed order avoids deadlocks
    const done = await tx.update(s.productVariants)
      .set({ stock: sql`${s.productVariants.stock} - ${qty}` })
      .where(and(eq(s.productVariants.id, variantId), sql`${s.productVariants.stock} >= ${qty}`))
      .returning({ id: s.productVariants.id });
    if (!done.length) throw new OutOfStockError(variantId);
  }
}

export async function releaseStock(tx: Tx, need: Map<string, number>) {
  for (const [variantId, qty] of [...need].sort(([a], [b]) => a.localeCompare(b))) {
    await tx.update(s.productVariants).set({ stock: sql`${s.productVariants.stock} + ${qty}` }).where(eq(s.productVariants.id, variantId));
  }
}

/** Returns an order's inventory exactly once (guarded by stock_reserved under a row lock). */
export async function releaseOrderStock(tx: Tx, orderId: string) {
  const [o] = await tx.update(s.orders).set({ stockReserved: false })
    .where(and(eq(s.orders.id, orderId), eq(s.orders.stockReserved, true))).returning({ id: s.orders.id });
  if (!o) return false;
  const items = await tx.select().from(s.orderItems).where(eq(s.orderItems.orderId, orderId));
  await releaseStock(tx, stockNeeds(items.map((i) => ({ quantity: 1, stock: i.stock }))));
  return true;
}

/** Cancels unpaid orders past their payment window and returns their stock. Safe to run concurrently. */
export async function expireStaleOrders() {
  const stale = await db.select({ id: s.orders.id }).from(s.orders)
    .where(and(eq(s.orders.status, "pending"), lt(s.orders.expiresAt, new Date()), eq(s.orders.stockReserved, true))).limit(100);
  for (const { id } of stale) {
    await db.transaction(async (tx) => {
      const [o] = await tx.select().from(s.orders).where(eq(s.orders.id, id)).for("update", { skipLocked: true });
      if (!o || o.status !== "pending" || o.expiresAt > new Date()) return;
      await releaseOrderStock(tx, id);
      await tx.update(s.orders).set({ status: "cancelled", note: "Payment window expired" }).where(eq(s.orders.id, id));
      await logOrderEvent(tx, id, "cancelled", "Payment window expired");
    });
  }
  return stale.length;
}

/** Appends to the order timeline (admin + customer history). */
export async function logOrderEvent(ex: Executor, orderId: string, status: string, message: string | null = null) {
  await ex.insert(s.orderEvents).values({ orderId, status, message });
}

export async function lockOrder(tx: Tx, orderId: string) {
  const [o] = await tx.select().from(s.orders).where(eq(s.orders.id, orderId)).for("update");
  return o ?? null;
}
