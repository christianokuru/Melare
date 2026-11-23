import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, inArray, like, sql } from "drizzle-orm";

vi.mock("web-push", () => ({ setVapidDetails: vi.fn(), sendNotification: vi.fn() }));
import * as webpush from "web-push";
import { db, schema as s } from "@/db";
import { isPushEndpoint, pushToAdmin } from "@/lib/push";
import { reviewPrompts, runningLow } from "@/lib/account";
import { settlePayment } from "@/lib/payments";
import { csvResponse } from "@/lib/csv";
import { randomCode } from "@/lib/utils";

const TAG = `test-${randomCode(5).toLowerCase()}`;
const email = (k: string) => `${TAG}-${k}@example.com`;
let productId: string;
let variantId: string;

async function makeUser(k: string) {
  const [u] = await db.insert(s.user).values({ id: `${TAG}-${k}`, name: `Test ${k}`, email: email(k), emailVerified: true }).returning();
  return u;
}

async function makeOrder(o: { userId: string | null; email: string; status: "pending" | "delivered"; paidDaysAgo?: number }) {
  const number = `MLR-${randomCode(8)}`;
  const [order] = await db.insert(s.orders).values({
    number, userId: o.userId, email: o.email, status: o.status, currency: "NGN", subtotal: 1000000, shippingFee: 0, total: 1000000,
    shippingAddress: { fullName: "T", phone: "+2348000000000", line1: "1 Test", city: "Ikeja", state: "Lagos", country: "NG" },
    shippingZone: "Lagos", expiresAt: new Date(Date.now() + 3_600_000), stockReserved: false,
    paidAt: o.paidDaysAgo != null ? sql`now() - make_interval(days => ${o.paidDaysAgo})` as unknown as Date : null,
  }).returning();
  await db.insert(s.orderItems).values({ orderId: order.id, productId, name: "Test serum", label: "30ml", unitPrice: 1000000, quantity: 1, stock: [{ variantId, quantity: 1 }] });
  return order;
}

beforeAll(async () => {
  const [p] = await db.insert(s.products).values({ slug: `${TAG}-serum`, name: "Test serum", tagline: "t", description: "test product", status: "active", daysSupply: 30 }).returning();
  const [v] = await db.insert(s.productVariants).values({ productId: p.id, sku: `${TAG.toUpperCase()}-30`, label: "30ml", priceNgn: 1000000, priceUsd: 1200, stock: 5 }).returning();
  productId = p.id;
  variantId = v.id;
});

afterAll(async () => {
  await db.delete(s.orders).where(like(s.orders.email, `${TAG}%`));
  await db.delete(s.products).where(like(s.products.slug, `${TAG}%`));
  await db.delete(s.user).where(like(s.user.email, `${TAG}%`));
});

describe("push notifications", () => {
  it("only accepts real browser push services (no SSRF)", () => {
    for (const ok of ["https://fcm.googleapis.com/fcm/send/abc", "https://web.push.apple.com/QK1", "https://updates.push.services.mozilla.com/wpush/v2/x", "https://wns2-db5p.notify.windows.com/w/?token=x"]) {
      expect(isPushEndpoint(ok), ok).toBe(true);
    }
    for (const bad of ["http://fcm.googleapis.com/fcm/send/abc", "https://fcm.googleapis.com.evil.com/x", "https://evil.com/push", "https://169.254.169.254/latest", "not a url", "javascript:alert(1)"]) {
      expect(isPushEndpoint(bad), bad).toBe(false);
    }
  });

  it("sends only to the admin's devices and drops expired subscriptions", async () => {
    const admin = await makeUser("admin");
    const customer = await makeUser("customer");
    process.env.ADMIN_EMAIL = admin.email;
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||= "test"; // pushEnabled() reads the module constant; keys exist in .env.local
    process.env.VAPID_PRIVATE_KEY = "test"; // web-push is mocked here; setup.ts removes the real key so other tests never push
    const keys = { p256dh: "k".repeat(87), auth: "a".repeat(22) };
    await db.insert(s.pushSubscriptions).values([
      { endpoint: `https://fcm.googleapis.com/fcm/send/${TAG}-live`, userId: admin.id, ...keys },
      { endpoint: `https://fcm.googleapis.com/fcm/send/${TAG}-gone`, userId: admin.id, ...keys },
      { endpoint: `https://fcm.googleapis.com/fcm/send/${TAG}-customer`, userId: customer.id, ...keys },
    ]);
    const send = vi.mocked(webpush.sendNotification);
    send.mockReset().mockImplementation(async (sub) => {
      if (sub.endpoint.endsWith("-gone")) throw Object.assign(new Error("Gone"), { statusCode: 410 });
      return { statusCode: 201, body: "", headers: {} };
    });

    await pushToAdmin({ title: "New order", body: "₦10,000", url: "/admin/orders/x" });

    const endpoints = send.mock.calls.map(([sub]) => sub.endpoint).filter((e) => e.includes(TAG));
    expect(endpoints.sort()).toEqual([`https://fcm.googleapis.com/fcm/send/${TAG}-gone`, `https://fcm.googleapis.com/fcm/send/${TAG}-live`]);
    expect(JSON.parse(String(send.mock.calls[0][1]))).toMatchObject({ title: "New order", url: "/admin/orders/x" });
    const left = await db.select({ endpoint: s.pushSubscriptions.endpoint }).from(s.pushSubscriptions).where(like(s.pushSubscriptions.endpoint, `%${TAG}%`));
    expect(left.map((r) => r.endpoint).sort()).toEqual([`https://fcm.googleapis.com/fcm/send/${TAG}-customer`, `https://fcm.googleapis.com/fcm/send/${TAG}-live`]);
  });
});

describe("customer dashboard data", () => {
  it("flags products that are about to run out, including guest orders with the same email", async () => {
    const u = await makeUser("buyer");
    await makeOrder({ userId: null, email: u.email.toUpperCase(), status: "delivered", paidDaysAgo: 28 }); // guest checkout, same email
    const low = await runningLow(u.id, u.email);
    expect(low).toHaveLength(1);
    expect(low[0]).toMatchObject({ productId, variantId, name: "Test serum" });
    expect(low[0].daysLeft).toBeGreaterThanOrEqual(1);
    expect(low[0].daysLeft).toBeLessThanOrEqual(3);
  });

  it("does not flag recent purchases, and never shows other people's orders", async () => {
    const u = await makeUser("fresh");
    await makeOrder({ userId: u.id, email: u.email, status: "delivered", paidDaysAgo: 2 });
    expect(await runningLow(u.id, u.email)).toHaveLength(0);
    const stranger = await makeUser("stranger");
    expect(await runningLow(stranger.id, stranger.email)).toHaveLength(0);
    expect(await reviewPrompts(stranger.id, stranger.email)).toHaveLength(0);
  });

  it("asks for a review on delivered products until one is written", async () => {
    const u = await makeUser("reviewer");
    await makeOrder({ userId: u.id, email: u.email, status: "delivered", paidDaysAgo: 5 });
    expect((await reviewPrompts(u.id, u.email)).map((p) => p.id)).toEqual([productId]);
    await db.insert(s.reviews).values({ productId, userId: u.id, authorName: "T", rating: 5, title: "Great", body: "Lovely", skinType: "Oily" });
    expect(await reviewPrompts(u.id, u.email)).toHaveLength(0);
  });
});

describe("order timeline", () => {
  it("records the payment on the order history", async () => {
    const u = await makeUser("payer");
    const order = await makeOrder({ userId: u.id, email: u.email, status: "pending" });
    const reference = `${order.number}-${randomCode(6)}`;
    await db.insert(s.payments).values({ orderId: order.id, reference, amount: order.total, currency: "NGN" });
    const r = await settlePayment({ provider: "flutterwave", id: String(Math.floor(Math.random() * 1e9)), reference, status: "successful", amount: order.total, currency: "NGN" });
    expect(r.status).toBe("paid");
    const events = await db.select().from(s.orderEvents).where(eq(s.orderEvents.orderId, order.id));
    expect(events.map((e) => [e.status, e.message])).toEqual([["paid", "Payment confirmed (Flutterwave)"]]);
    await db.delete(s.orderEvents).where(inArray(s.orderEvents.orderId, [order.id]));
  });
});

describe("CSV export", () => {
  it("neutralises spreadsheet formulas", async () => {
    const text = await csvResponse("x.csv", ["name"], [["=HYPERLINK(\"http://evil\")"], ["+cmd"], ["Ada \"Obi\""]]).text();
    expect(text.split("\n")).toEqual(['"name"', '"\'=HYPERLINK(""http://evil"")"', '"\'+cmd"', '"Ada ""Obi"""']);
  });
});
