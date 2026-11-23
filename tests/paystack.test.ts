import { createHmac } from "node:crypto";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, like } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { isValidPaystackSignature, providersFor, startPayment, verifyPayment, type Provider } from "@/lib/gateways";
import { randomCode } from "@/lib/utils";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }));
const { POST } = await import("@/app/api/webhooks/paystack/route");

// Throwaway test secret: real keys never appear in tests.
const SECRET = `sk_test_${randomCode(24).toLowerCase()}`;
const TAG = `pstk-${randomCode(5).toLowerCase()}`;
const saved = { key: process.env.PAYSTACK_SECRET_KEY, cur: process.env.PAYSTACK_CURRENCIES };
beforeAll(() => { process.env.PAYSTACK_SECRET_KEY = SECRET; delete process.env.PAYSTACK_CURRENCIES; });
afterEach(() => vi.unstubAllGlobals());
afterAll(async () => {
  process.env.PAYSTACK_SECRET_KEY = saved.key ?? ""; if (saved.cur) process.env.PAYSTACK_CURRENCIES = saved.cur;
  await db.delete(s.orders).where(like(s.orders.email, `${TAG}%`));
});

const sign = (body: string, key = SECRET) => createHmac("sha512", key).update(body).digest("hex");
const hook = (body: string, sig: string | null = sign(body), headers: Record<string, string> = {}) =>
  POST(new Request("http://localhost/api/webhooks/paystack", { method: "POST", body, headers: { "content-type": "application/json", ...(sig ? { "x-paystack-signature": sig } : {}), ...headers } }));
const chargeEvent = (reference: string, extra: object = {}) => JSON.stringify({ event: "charge.success", data: { reference, status: "success", amount: 1, currency: "NGN", ...extra } });

/** Fake Paystack API: answers verify calls with `verify` and records every call. */
function fakePaystack(verify: Record<string, unknown> | null, init?: Record<string, unknown>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal("fetch", vi.fn(async (url: string, opts?: RequestInit) => {
    calls.push({ url: String(url), init: opts });
    if (String(url).includes("/transaction/initialize")) return Response.json(init ?? { status: true, data: { authorization_url: "https://checkout.paystack.com/abc123", reference: "x" } });
    return verify ? Response.json({ status: true, data: verify }) : Response.json({ status: false, message: "Transaction reference not found" }, { status: 400 });
  }));
  return calls;
}

async function makeOrder(provider: Provider = "paystack", total = 2_500_000) {
  const number = `MLR-${randomCode(8)}`;
  const [o] = await db.insert(s.orders).values({
    number, email: `${TAG}@example.com`, currency: "NGN", subtotal: total, shippingFee: 0, total,
    shippingAddress: { fullName: "Test", phone: "+2348012345678", line1: "1 Test", city: "Ikeja", state: "Lagos", country: "NG" },
    shippingZone: "Lagos", expiresAt: new Date(Date.now() + 3_600_000),
  }).returning();
  const reference = `${number}-${randomCode(6)}`;
  await db.insert(s.payments).values({ orderId: o.id, provider, reference, amount: total, currency: "NGN" });
  return { order: o, reference, total };
}
const statusOf = async (id: string) => (await db.select().from(s.orders).where(eq(s.orders.id, id)))[0].status;
const paid = (reference: string, amount: number, over: object = {}) => ({ id: Math.floor(Math.random() * 1e9), reference, status: "success", amount, currency: "NGN", ...over });

describe("Paystack webhook signature", () => {
  const body = chargeEvent("MLR-AAAAAAAA-BBBBBB");
  it("accepts only an exact HMAC-SHA512 of the raw body with our secret", () => {
    expect(isValidPaystackSignature(body, sign(body))).toBe(true);
    expect(isValidPaystackSignature(body, sign(body).toUpperCase())).toBe(true); // hex case-insensitive
    expect(isValidPaystackSignature(body, sign(body, "sk_test_attacker"))).toBe(false); // attacker's own key
    expect(isValidPaystackSignature(`${body} `, sign(body))).toBe(false); // tampered body
    expect(isValidPaystackSignature(body.replace('"amount":1', '"amount":2'), sign(body))).toBe(false);
    expect(isValidPaystackSignature(body, createHmac("sha256", SECRET).update(body).digest("hex"))).toBe(false); // wrong algorithm
    for (const bad of [null, "", "abc", "z".repeat(128), sign(body).slice(0, 127), `${sign(body)}00`]) expect(isValidPaystackSignature(body, bad)).toBe(false);
  });
  it("fails closed when no secret is configured", () => {
    process.env.PAYSTACK_SECRET_KEY = "";
    try { expect(isValidPaystackSignature(body, createHmac("sha512", "").update(body).digest("hex"))).toBe(false); }
    finally { process.env.PAYSTACK_SECRET_KEY = SECRET; }
  });
});

describe("Paystack webhook route", () => {
  it("rejects unsigned, badly signed and oversized requests without touching Paystack", async () => {
    const calls = fakePaystack(null);
    const { reference } = await makeOrder();
    const body = chargeEvent(reference);
    expect((await hook(body, null)).status).toBe(401);
    expect((await hook(body, sign(body, "sk_test_guess"))).status).toBe(401);
    expect((await hook(body, "f".repeat(128))).status).toBe(401);
    const big = JSON.stringify({ event: "charge.success", data: { reference, pad: "x".repeat(70_000) } });
    expect((await hook(big)).status).toBe(401);
    expect((await hook(body, sign(body), { "content-length": "999999" })).status).toBe(413);
    expect(calls).toHaveLength(0);
  });

  it("never trusts the body: a signed event is re-verified with Paystack before paying", async () => {
    const { order, reference, total } = await makeOrder();
    // Body claims success, Paystack's verify API says the customer abandoned it → stays pending.
    let calls = fakePaystack(paid(reference, total, { status: "abandoned" }));
    expect((await hook(chargeEvent(reference, { amount: total }))).status).toBe(200);
    expect(calls.map((c) => c.url)).toEqual([`https://api.paystack.co/transaction/verify/${reference}`]);
    expect(calls[0].init?.headers).toMatchObject({ Authorization: `Bearer ${SECRET}` });
    expect(await statusOf(order.id)).toBe("pending");
    // Verify confirms → paid.
    calls = fakePaystack(paid(reference, total));
    await hook(chargeEvent(reference));
    expect(await statusOf(order.id)).toBe("paid");
  });

  it("is idempotent under replays and parallel deliveries", async () => {
    const { order, reference, total } = await makeOrder();
    fakePaystack(paid(reference, total));
    const body = chargeEvent(reference);
    const res = await Promise.all([hook(body), hook(body), hook(body)]);
    expect(res.map((r) => r.status)).toEqual([200, 200, 200]);
    await hook(body); // later replay
    const events = await db.select().from(s.orderEvents).where(eq(s.orderEvents.orderId, order.id));
    expect(events.filter((e) => e.status === "paid")).toHaveLength(1);
    const [p] = await db.select().from(s.payments).where(eq(s.payments.reference, reference));
    expect(p.status).toBe("success");
  });

  it("refuses underpayment, wrong currency, decimal tricks and a different reference", async () => {
    for (const over of [{ amount: 2_499_999 }, { currency: "USD" }, { amount: 2_500_000.5 }, { amount: "2500000" }]) {
      const { order, reference, total } = await makeOrder();
      fakePaystack(paid(reference, total, over));
      await hook(chargeEvent(reference));
      expect(await statusOf(order.id), JSON.stringify(over)).toBe("pending");
    }
    const { order, reference, total } = await makeOrder();
    const other = await makeOrder();
    fakePaystack(paid(other.reference, total)); // Paystack answers for a different (paid) reference
    await hook(chargeEvent(reference));
    expect(await statusOf(order.id)).toBe("pending");
    expect(await statusOf(other.order.id)).toBe("pending");
  });

  it("can't pay a Flutterwave order with a Paystack transaction (cross-gateway)", async () => {
    const { order, reference, total } = await makeOrder("flutterwave");
    fakePaystack(paid(reference, total));
    await hook(chargeEvent(reference));
    expect(await statusOf(order.id)).toBe("pending");
  });

  it("ignores non-charge events and malformed references without calling Paystack", async () => {
    const calls = fakePaystack(null);
    const { reference } = await makeOrder();
    for (const body of [
      JSON.stringify({ event: "transfer.success", data: { reference } }),
      chargeEvent("MLR-AAAAAAAA-BBBBBB' OR 1=1--"),
      chargeEvent("../../transaction/totals"),
      JSON.stringify({ event: "charge.success", data: { reference: { $ne: null } } }),
      "not json",
    ]) expect((await hook(body)).status).toBe(200);
    expect(calls).toHaveLength(0);
  });

  it("returns 500 (so Paystack retries) only when our side fails after a valid signature", async () => {
    const { reference, total } = await makeOrder();
    fakePaystack(paid(reference, total));
    const spy = vi.spyOn(db, "transaction").mockRejectedValueOnce(new Error("db down"));
    await expect(hook(chargeEvent(reference))).rejects.toThrow("db down");
    spy.mockRestore();
  });
});

describe("Paystack checkout start", () => {
  const input = { reference: "MLR-AAAAAAAA-BBBBBB", amount: 2_500_000, currency: "NGN" as const, email: "ada@example.com", name: "Ada", phone: "+2348012345678" };

  it("sends the exact kobo amount, our reference and our callback, server-side only", async () => {
    const calls = fakePaystack(null);
    expect(await startPayment("paystack", input)).toBe("https://checkout.paystack.com/abc123");
    const sent = JSON.parse(String(calls[0].init?.body));
    expect(sent).toMatchObject({ reference: input.reference, amount: 2_500_000, currency: "NGN", email: input.email });
    expect(sent.callback_url).toMatch(/\/checkout\/complete$/);
    expect(calls[0].init?.headers).toMatchObject({ Authorization: `Bearer ${SECRET}` });
  });

  it("refuses a hosted-page URL that isn't Paystack's (no open redirect via a tampered response)", async () => {
    fakePaystack(null, { status: true, data: { authorization_url: "https://evil.example/pay" } });
    await expect(startPayment("paystack", input)).rejects.toThrow();
    fakePaystack(null, { status: false, message: "Invalid key" });
    await expect(startPayment("paystack", input)).rejects.toThrow("Invalid key");
  });

  it("only offers Paystack for enabled currencies and with a real-looking secret key", async () => {
    expect(providersFor("NGN")[0]).toBe("paystack");
    expect(providersFor("USD")).not.toContain("paystack"); // USD must be enabled explicitly
    await expect(startPayment("paystack", { ...input, currency: "USD" })).rejects.toThrow();
    process.env.PAYSTACK_CURRENCIES = "NGN,USD";
    expect(providersFor("USD")).toContain("paystack");
    delete process.env.PAYSTACK_CURRENCIES;
    process.env.PAYSTACK_SECRET_KEY = "pk_test_public_key_by_mistake";
    try { expect(providersFor("NGN")).not.toContain("paystack"); } finally { process.env.PAYSTACK_SECRET_KEY = SECRET; }
  });

  it("verify rejects malformed references before any network call and maps statuses safely", async () => {
    const calls = fakePaystack(null);
    expect(await verifyPayment("paystack", "MLR-x/../../balance")).toBeNull();
    expect(calls).toHaveLength(0);
    const ref = "MLR-AAAAAAAA-BBBBBB";
    for (const [st, want] of [["success", "successful"], ["reversed", "failed"], ["failed", "failed"], ["abandoned", "pending"], ["ongoing", "pending"]] as const) {
      fakePaystack(paid(ref, 100, { status: st }));
      expect((await verifyPayment("paystack", ref))?.status).toBe(want);
    }
  });
});
