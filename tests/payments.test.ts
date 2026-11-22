import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, inArray, like } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { applyCode, expireStaleOrders, releaseOrderStock, reserveStock, OutOfStockError } from "@/lib/checkout";
import { settlePayment } from "@/lib/payments";
import { randomCode } from "@/lib/utils";

const TAG = `TEST-${randomCode(5)}`;
let variantId: string;
let productId: string;

async function makeVariant(stock: number) {
  const [p] = await db.insert(s.products).values({ slug: `${TAG.toLowerCase()}-${randomCode(4).toLowerCase()}`, name: "Test product", tagline: "t", description: "test product", status: "active" }).returning();
  const [v] = await db.insert(s.productVariants).values({ productId: p.id, sku: `${TAG}-${randomCode(4)}`, label: "30ml", priceNgn: 1000000, priceUsd: 1200, stock }).returning();
  productId = p.id;
  return v.id;
}

async function makeOrder(opts: { qty?: number; total?: number; expired?: boolean; couponId?: string | null; reserve?: boolean } = {}) {
  const qty = opts.qty ?? 1;
  const total = opts.total ?? 1000000 * qty;
  const number = `MLR-${randomCode(8)}`;
  const cart = (await db.insert(s.carts).values({}).returning())[0];
  await db.insert(s.cartItems).values({ cartId: cart.id, variantId, quantity: qty });
  const order = await db.transaction(async (tx) => {
    if (opts.reserve !== false) await reserveStock(tx, new Map([[variantId, qty]]));
    const [o] = await tx.insert(s.orders).values({
      number, email: `${TAG.toLowerCase()}@example.com`, currency: "NGN", subtotal: total, shippingFee: 0, total, couponId: opts.couponId ?? null,
      shippingAddress: { fullName: "T", phone: "+2348000000000", line1: "1 Test", city: "Ikeja", state: "Lagos", country: "NG" },
      shippingZone: "Lagos", cartId: cart.id, expiresAt: new Date(Date.now() + (opts.expired ? -60_000 : 3_600_000)),
    }).returning();
    await tx.insert(s.orderItems).values({ orderId: o.id, productId, name: "Test product", label: "30ml", unitPrice: total / qty, quantity: qty, stock: [{ variantId, quantity: qty }] });
    return o;
  });
  const reference = `${number}-${randomCode(6)}`;
  await db.insert(s.payments).values({ orderId: order.id, reference, amount: total, currency: "NGN" });
  return { order, reference, cartId: cart.id };
}

const stockOf = async () => (await db.select().from(s.productVariants).where(eq(s.productVariants.id, variantId)))[0].stock;
const orderOf = async (id: string) => (await db.select().from(s.orders).where(eq(s.orders.id, id)))[0];
const tx = (reference: string, over: Partial<{ status: string; amount: number; currency: string }> = {}) =>
  ({ id: Math.floor(Math.random() * 1e9), tx_ref: reference, status: "successful", amount: 10000, currency: "NGN", ...over });

beforeEach(async () => { variantId = await makeVariant(5); });

afterAll(async () => {
  const orders = await db.select({ id: s.orders.id }).from(s.orders).where(like(s.orders.email, `${TAG.toLowerCase()}%`));
  if (orders.length) await db.delete(s.orders).where(inArray(s.orders.id, orders.map((o) => o.id)));
  await db.delete(s.products).where(like(s.products.slug, `${TAG.toLowerCase()}%`));
  await db.delete(s.coupons).where(like(s.coupons.code, `${TAG}%`));
  await db.delete(s.user).where(like(s.user.email, `${TAG.toLowerCase()}%`));
});

describe("stock reservation", () => {
  it("never oversells under concurrency", async () => {
    variantId = await makeVariant(1);
    const attempt = () => db.transaction((t) => reserveStock(t, new Map([[variantId, 1]]))).then(() => "ok", (e) => (e instanceof OutOfStockError ? "sold-out" : Promise.reject(e)));
    const results = await Promise.all([attempt(), attempt(), attempt()]);
    expect(results.filter((r) => r === "ok")).toHaveLength(1);
    expect(await stockOf()).toBe(0);
  });

  it("releases an order's stock exactly once", async () => {
    const { order } = await makeOrder({ qty: 2 });
    expect(await stockOf()).toBe(3);
    await db.transaction((t) => releaseOrderStock(t, order.id));
    await db.transaction((t) => releaseOrderStock(t, order.id));
    expect(await stockOf()).toBe(5);
  });
});

describe("settlePayment", () => {
  it("rejects an amount mismatch and keeps the order unpaid", async () => {
    const { order, reference } = await makeOrder();
    const r = await settlePayment(tx(reference, { amount: 100 }));
    expect(r.status).toBe("mismatch");
    expect((await orderOf(order.id)).status).toBe("pending");
    const [p] = await db.select().from(s.payments).where(eq(s.payments.reference, reference));
    expect(p.status).toBe("failed");
  });

  it("rejects a currency mismatch", async () => {
    const { order, reference } = await makeOrder();
    expect((await settlePayment(tx(reference, { currency: "USD" }))).status).toBe("mismatch");
    expect((await orderOf(order.id)).status).toBe("pending");
  });

  it("ignores unknown references", async () => {
    expect((await settlePayment(tx("MLR-NOPE0000-AAAAAA"))).status).toBe("unknown");
  });

  it("does not mark paid when Flutterwave says failed", async () => {
    const { order, reference } = await makeOrder();
    expect((await settlePayment(tx(reference, { status: "failed" }))).status).toBe("failed");
    expect((await orderOf(order.id)).status).toBe("pending");
  });

  it("marks paid, redeems coupon, clears cart — and is idempotent", async () => {
    const [coupon] = await db.insert(s.coupons).values({ code: `${TAG}-C1`, percentOff: 10 }).returning();
    const { order, reference, cartId } = await makeOrder({ couponId: coupon.id });
    const t = tx(reference);
    expect((await settlePayment(t)).status).toBe("paid");
    expect((await settlePayment(t)).status).toBe("paid");
    const o = await orderOf(order.id);
    expect(o.status).toBe("paid");
    expect(o.paidAt).not.toBeNull();
    expect((await db.select().from(s.coupons).where(eq(s.coupons.id, coupon.id)))[0].redemptions).toBe(1);
    expect(await db.select().from(s.cartItems).where(eq(s.cartItems.cartId, cartId))).toHaveLength(0);
    expect(await stockOf()).toBe(4);
  });

  it("flags a duplicate payment on an already-paid order", async () => {
    const { order, reference } = await makeOrder();
    await settlePayment(tx(reference));
    const second = `${order.number}-${randomCode(6)}`;
    await db.insert(s.payments).values({ orderId: order.id, reference: second, amount: order.total, currency: "NGN" });
    expect((await settlePayment(tx(second))).status).toBe("paid");
    expect((await orderOf(order.id)).note).toMatch(/Duplicate payment/);
  });
});

describe("payment window expiry", () => {
  it("expires unpaid orders and returns stock; a late payment re-reserves it", async () => {
    const { order, reference } = await makeOrder({ expired: true });
    expect(await stockOf()).toBe(4);
    await expireStaleOrders();
    let o = await orderOf(order.id);
    expect(o.status).toBe("cancelled");
    expect(await stockOf()).toBe(5);
    expect((await settlePayment(tx(reference))).status).toBe("paid");
    o = await orderOf(order.id);
    expect(o.status).toBe("paid");
    expect(o.stockReserved).toBe(true);
    expect(await stockOf()).toBe(4);
  });

  it("flags a late payment when stock is gone", async () => {
    const { order, reference } = await makeOrder({ expired: true, qty: 5 });
    await expireStaleOrders();
    await db.update(s.productVariants).set({ stock: 0 }).where(eq(s.productVariants.id, variantId));
    await settlePayment(tx(reference, { amount: 50000 }));
    const o = await orderOf(order.id);
    expect(o.status).toBe("paid");
    expect(o.note).toMatch(/stock ran out/);
    expect(await stockOf()).toBe(0);
  });
});

describe("applyCode", () => {
  const buyer = { userId: null, email: `${TAG.toLowerCase()}-buyer@example.com` };

  it("applies a percentage coupon and caps discounts", async () => {
    await db.insert(s.coupons).values({ code: `${TAG}-P20`, percentOff: 20 });
    const r = await applyCode(`${TAG}-p20`, buyer, "NGN", 1000000);
    expect(r.ok && r.applied.discount).toBe(200000);
    await db.insert(s.coupons).values({ code: `${TAG}-BIG`, amountOffNgn: 99999900, amountOffUsd: 999900 });
    const big = await applyCode(`${TAG}-BIG`, buyer, "NGN", 500000);
    expect(big.ok && big.applied.discount).toBe(499900); // capped at subtotal − ₦1
  });

  it("rejects expired, exhausted, minimum-unmet and other people's personal coupons", async () => {
    await db.insert(s.coupons).values([
      { code: `${TAG}-OLD`, percentOff: 10, expiresAt: new Date(Date.now() - 1000) },
      { code: `${TAG}-USED`, percentOff: 10, maxRedemptions: 1, redemptions: 1 },
      { code: `${TAG}-MIN`, percentOff: 10, minSubtotalNgn: 5000000 },
    ]);
    const [u] = await db.insert(s.user).values({ id: randomCode(16), name: "Owner", email: `${TAG.toLowerCase()}-owner@example.com`, emailVerified: true }).returning();
    await db.insert(s.coupons).values({ code: `${TAG}-MINE`, amountOffNgn: 200000, amountOffUsd: 300, userId: u.id, maxRedemptions: 1 });
    for (const code of ["OLD", "USED", "MIN", "MINE"]) expect((await applyCode(`${TAG}-${code}`, buyer, "NGN", 1000000)).ok).toBe(false);
    expect((await applyCode(`${TAG}-MINE`, { userId: u.id, email: u.email }, "NGN", 1000000)).ok).toBe(true);
  });

  it("referral codes: not your own, first order only", async () => {
    const [ref] = await db.insert(s.user).values({ id: randomCode(16), name: "Ref", email: `${TAG.toLowerCase()}-ref@example.com`, emailVerified: true, referralCode: `${TAG}R` }).returning();
    expect((await applyCode(`${TAG}R`, { userId: ref.id, email: ref.email }, "NGN", 1000000)).ok).toBe(false);
    const ok = await applyCode(`${TAG}R`, buyer, "NGN", 1000000);
    expect(ok.ok && ok.applied.kind).toBe("referral");
    const { reference } = await makeOrder();
    await db.update(s.orders).set({ email: buyer.email }).where(eq(s.orders.number, reference.slice(0, 12)));
    await settlePayment(tx(reference));
    expect((await applyCode(`${TAG}R`, buyer, "NGN", 1000000)).ok).toBe(false);
  });
});
