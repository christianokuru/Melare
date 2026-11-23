import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, inArray, like } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { applyCode, canonicalEmail, CODE_INVALID, expireStaleOrders, lockBuyer, releaseOrderStock, reserveStock, OutOfStockError } from "@/lib/checkout";
import { settlePayment } from "@/lib/payments";
import type { VerifiedTx } from "@/lib/gateways";
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

async function makeOrder(opts: { qty?: number; total?: number; expired?: boolean; couponId?: string | null; reserve?: boolean; email?: string; phone?: string; userId?: string; referrerId?: string } = {}) {
  const qty = opts.qty ?? 1;
  const total = opts.total ?? 1000000 * qty;
  const number = `MLR-${randomCode(8)}`;
  const cart = (await db.insert(s.carts).values({}).returning())[0];
  await db.insert(s.cartItems).values({ cartId: cart.id, variantId, quantity: qty });
  const order = await db.transaction(async (tx) => {
    if (opts.reserve !== false) await reserveStock(tx, new Map([[variantId, qty]]));
    const [o] = await tx.insert(s.orders).values({
      number, email: opts.email ?? `${TAG.toLowerCase()}@example.com`, userId: opts.userId ?? null, referrerId: opts.referrerId ?? null,
      currency: "NGN", subtotal: total, shippingFee: 0, total, couponId: opts.couponId ?? null,
      shippingAddress: { fullName: "T", phone: opts.phone ?? `+23480${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`, line1: "1 Test", city: "Ikeja", state: "Lagos", country: "NG" },
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
const tx = (reference: string, over: Partial<VerifiedTx> = {}): VerifiedTx =>
  ({ provider: "flutterwave", id: String(Math.floor(Math.random() * 1e9)), reference, status: "successful", amount: 1000000, currency: "NGN", ...over });

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
    const r = await settlePayment(tx(reference, { amount: 10000 }));
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
    await settlePayment(tx(reference, { amount: 5000000 }));
    const o = await orderOf(order.id);
    expect(o.status).toBe("paid");
    expect(o.note).toMatch(/stock ran out/);
    expect(await stockOf()).toBe(0);
  });
});

describe("applyCode", () => {
  const mkUser = async (k: string, extra: Partial<typeof s.user.$inferInsert> = {}) =>
    (await db.insert(s.user).values({ id: randomCode(16), name: k, email: `${TAG.toLowerCase()}-${k}@example.com`, emailVerified: true, ...extra }).returning())[0];
  const phone = () => `+23481${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;

  it("codes need a signed-in account", async () => {
    await db.insert(s.coupons).values({ code: `${TAG}-GUEST`, percentOff: 10 });
    const r = await applyCode(`${TAG}-GUEST`, { userId: null, email: `${TAG.toLowerCase()}-g@example.com` }, "NGN", 1000000);
    expect(r).toEqual({ ok: false, error: "Sign in to use a promo or referral code." });
  });

  it("applies a percentage coupon and caps discounts", async () => {
    const u = await mkUser("pct");
    const buyer = { userId: u.id, email: u.email };
    await db.insert(s.coupons).values({ code: `${TAG}-P20`, percentOff: 20 });
    const r = await applyCode(`${TAG}-p20`, buyer, "NGN", 1000000);
    expect(r.ok && r.applied.discount).toBe(200000);
    await db.insert(s.coupons).values({ code: `${TAG}-BIG`, amountOffNgn: 99999900, amountOffUsd: 999900 });
    const big = await applyCode(`${TAG}-BIG`, buyer, "NGN", 500000);
    expect(big.ok && big.applied.discount).toBe(499900); // capped at subtotal − ₦1
  });

  it("rejects expired, exhausted, minimum-unmet, unknown and other people's codes with ONE message (no oracle)", async () => {
    await db.insert(s.coupons).values([
      { code: `${TAG}-OLD`, percentOff: 10, expiresAt: new Date(Date.now() - 1000) },
      { code: `${TAG}-USED`, percentOff: 10, maxRedemptions: 1, redemptions: 1 },
      { code: `${TAG}-MIN`, percentOff: 10, minSubtotalNgn: 5000000 },
    ]);
    const owner = await mkUser("owner");
    const buyer = await mkUser("other");
    await db.insert(s.coupons).values({ code: `${TAG}-MINE`, amountOffNgn: 200000, amountOffUsd: 300, userId: owner.id, maxRedemptions: 1 });
    for (const code of ["OLD", "USED", "MIN", "MINE", "NOPE"]) {
      expect(await applyCode(`${TAG}-${code}`, { userId: buyer.id, email: buyer.email }, "NGN", 1000000)).toEqual({ ok: false, error: CODE_INVALID });
    }
    expect((await applyCode(`${TAG}-MINE`, { userId: owner.id, email: owner.email }, "NGN", 1000000)).ok).toBe(true);
  });

  it("once per person: unpaid orders, Gmail aliases and the same phone all count", async () => {
    const [c] = await db.insert(s.coupons).values({ code: `${TAG}-ONCE`, percentOff: 10 }).returning();
    const u = await mkUser("once", { email: `${TAG.toLowerCase()}.once@gmail.com` });
    const p = phone();
    await makeOrder({ couponId: c.id, email: u.email, phone: p, userId: u.id }); // still awaiting payment
    expect((await applyCode(`${TAG}-ONCE`, { userId: u.id, email: u.email }, "NGN", 1000000)).ok).toBe(false);
    const alias = await mkUser("alias", { email: `${TAG.toLowerCase()}once+promo@gmail.com` }); // same inbox, new account
    expect(canonicalEmail(alias.email)).toBe(canonicalEmail(u.email));
    expect((await applyCode(`${TAG}-ONCE`, { userId: alias.id, email: alias.email }, "NGN", 1000000)).ok).toBe(false);
    const stranger = await mkUser("samephone");
    expect((await applyCode(`${TAG}-ONCE`, { userId: stranger.id, email: stranger.email, phone: p.replace("+234", "0") }, "NGN", 1000000)).ok).toBe(false);
    expect((await applyCode(`${TAG}-ONCE`, { userId: stranger.id, email: stranger.email, phone: phone() }, "NGN", 1000000)).ok).toBe(true);
  });

  it("unpaid orders hold a redemption, so a 1-use code can't be opened twice", async () => {
    const [c] = await db.insert(s.coupons).values({ code: `${TAG}-ONE`, percentOff: 10, maxRedemptions: 1 }).returning();
    const a = await mkUser("one-a");
    const b = await mkUser("one-b");
    await makeOrder({ couponId: c.id, email: a.email, userId: a.id });
    expect((await applyCode(`${TAG}-ONE`, { userId: b.id, email: b.email, phone: phone() }, "NGN", 1000000)).ok).toBe(false);
  });

  it("parallel checkouts by one person can't both use a code", async () => {
    const [c] = await db.insert(s.coupons).values({ code: `${TAG}-RACE`, percentOff: 10 }).returning();
    const u = await mkUser("race");
    const buyer = { userId: u.id, email: u.email, phone: phone() };
    const checkout = () => db.transaction(async (t) => {
      await lockBuyer(t, buyer);
      const r = await applyCode(`${TAG}-RACE`, buyer, "NGN", 1000000, t, true);
      if (!r.ok) return "rejected";
      await t.insert(s.orders).values({
        number: `MLR-${randomCode(8)}`, email: u.email, userId: u.id, currency: "NGN", subtotal: 1000000, shippingFee: 0, total: 900000, couponId: c.id,
        shippingAddress: { fullName: "T", phone: buyer.phone, line1: "1", city: "Ikeja", state: "Lagos", country: "NG" }, shippingZone: "Lagos",
        expiresAt: new Date(Date.now() + 1_800_000), stockReserved: false,
      });
      return "ok";
    });
    const results = await Promise.all([checkout(), checkout(), checkout()]);
    expect(results.filter((r) => r === "ok")).toHaveLength(1);
  });

  it("referral codes: not your own (account, alias or phone), minimum spend, first order only", async () => {
    const refPhone = phone();
    const ref = await mkUser("ref", { email: `${TAG.toLowerCase()}ref@gmail.com`, referralCode: `${TAG}R`, phone: refPhone });
    expect((await applyCode(`${TAG}R`, { userId: ref.id, email: ref.email }, "NGN", 1000000)).ok).toBe(false);
    const alias = await mkUser("ref-alias", { email: `${TAG.toLowerCase()}r.e.f+1@gmail.com` });
    expect((await applyCode(`${TAG}R`, { userId: alias.id, email: alias.email }, "NGN", 1000000)).ok).toBe(false);
    const friend = await mkUser("friend");
    expect((await applyCode(`${TAG}R`, { userId: friend.id, email: friend.email, phone: refPhone }, "NGN", 1000000)).ok).toBe(false); // referrer's own phone
    expect((await applyCode(`${TAG}R`, { userId: friend.id, email: friend.email, phone: phone() }, "NGN", 500000)).ok).toBe(false); // under ₦10,000
    const ok = await applyCode(`${TAG}R`, { userId: friend.id, email: friend.email, phone: phone() }, "NGN", 1000000);
    expect(ok.ok && ok.applied.kind).toBe("referral");
    await makeOrder({ email: friend.email, userId: friend.id }); // unpaid order counts as their first
    expect((await applyCode(`${TAG}R`, { userId: friend.id, email: friend.email }, "NGN", 1000000)).ok).toBe(false);
  });

  it("issues the referral reward only for the buyer's first PAID order", async () => {
    const ref = await mkUser("ref2", { referralCode: `${TAG}R2` });
    const buyer = await mkUser("buyer2");
    const p = phone();
    const first = await makeOrder({ email: buyer.email, userId: buyer.id, phone: p, referrerId: ref.id });
    const second = await makeOrder({ email: buyer.email, userId: buyer.id, phone: p, referrerId: ref.id });
    await settlePayment(tx(first.reference));
    await settlePayment(tx(second.reference));
    const rewards = await db.select().from(s.coupons).where(eq(s.coupons.userId, ref.id));
    expect(rewards).toHaveLength(1);
  });
});
