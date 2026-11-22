import "server-only";
import { and, asc, eq, lt, notInArray, or, sql } from "drizzle-orm";
import { db, schema as s, type Tx } from "@/db";
import type { CartLine } from "./cart";
import { priceIn, type Currency } from "./money";
import { REFERRAL_REWARD } from "./constants";

const UNIT = 100; // one naira / one dollar in minor units
const NOT_PURCHASED = ["pending", "cancelled"] as const;

export type Buyer = { userId: string | null; email: string };
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

async function hasPurchased(buyer: Buyer, ex: Executor) {
  const [row] = await ex.select({ id: s.orders.id }).from(s.orders).where(and(
    buyer.userId ? or(eq(s.orders.email, buyer.email), eq(s.orders.userId, buyer.userId)) : eq(s.orders.email, buyer.email),
    notInArray(s.orders.status, [...NOT_PURCHASED]),
  )).limit(1);
  return !!row;
}

/**
 * Validates a coupon or referral code for this buyer and subtotal.
 * Returns the discount (never more than subtotal − ₦1/$1) or an error message.
 */
export async function applyCode(rawCode: string, buyer: Buyer, currency: Currency, subtotal: number, ex: Executor = db):
  Promise<{ ok: true; applied: Applied } | { ok: false; error: string }> {
  const code = rawCode.trim().toUpperCase();
  if (!/^[A-Z0-9-]{3,32}$/.test(code)) return { ok: false, error: "That code isn’t valid." };
  const cap = (d: number) => Math.max(0, Math.min(d, subtotal - UNIT));

  const [c] = await ex.select().from(s.coupons).where(eq(s.coupons.code, code));
  if (c) {
    if (!c.active || (c.expiresAt && c.expiresAt < new Date())) return { ok: false, error: "This code has expired." };
    if (c.maxRedemptions != null && c.redemptions >= c.maxRedemptions) return { ok: false, error: "This code has been fully redeemed." };
    if (c.userId && c.userId !== buyer.userId) return { ok: false, error: "Sign in to the account this code belongs to." };
    const min = currency === "NGN" ? c.minSubtotalNgn : c.minSubtotalUsd;
    if (min != null && subtotal < min) return { ok: false, error: "Your bag doesn’t meet this code’s minimum yet." };
    const [used] = await ex.select({ id: s.orders.id }).from(s.orders)
      .where(and(eq(s.orders.couponId, c.id), eq(s.orders.email, buyer.email), notInArray(s.orders.status, [...NOT_PURCHASED]))).limit(1);
    if (used) return { ok: false, error: "You’ve already used this code." };
    const raw = c.percentOff != null
      ? Math.floor((subtotal * c.percentOff) / 100 / UNIT) * UNIT
      : (currency === "NGN" ? c.amountOffNgn! : c.amountOffUsd!);
    return { ok: true, applied: { kind: "coupon", couponId: c.id, code, discount: cap(raw) } };
  }

  const [referrer] = await ex.select({ id: s.user.id, email: s.user.email }).from(s.user).where(eq(s.user.referralCode, code));
  if (referrer) {
    if (referrer.id === buyer.userId || referrer.email.toLowerCase() === buyer.email.toLowerCase())
      return { ok: false, error: "You can’t use your own referral code." };
    if (await hasPurchased(buyer, ex)) return { ok: false, error: "Referral codes are for first orders only." };
    return { ok: true, applied: { kind: "referral", referrerId: referrer.id, code, discount: cap(REFERRAL_REWARD[currency]) } };
  }
  return { ok: false, error: "That code isn’t valid." };
}

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
