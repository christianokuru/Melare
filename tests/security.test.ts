import { afterAll, describe, expect, it } from "vitest";
import { like } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { safeNext } from "@/lib/auth-client";
import { signEmailToken, verifyEmailToken } from "@/lib/email-tokens";
import { canonicalEmail, currencyFor, openOrders, phoneKey } from "@/lib/checkout";
import { cleanName, PERSON_NAME, randomCode } from "@/lib/utils";

const TAG = `sec-${randomCode(5).toLowerCase()}`;
afterAll(async () => { await db.delete(s.orders).where(like(s.orders.email, `${TAG}%`)); });

describe("open redirects", () => {
  it("blocks every known bypass and keeps real paths", () => {
    const next = (raw: string) => safeNext(new URLSearchParams(`next=${raw}`).get("next"));
    for (const bad of ["/%09/evil.com", "/%0a/evil.com", "/%0d%0a/evil.com", "//evil.com", "/%2F/evil.com", "/%5Cevil.com", "https://evil.com", "javascript:alert(1)", "/%E2%80%A8/evil.com", "/%00/evil.com"]) {
      expect(next(bad), bad).toBe("/account");
    }
    expect(next("/checkout")).toBe("/checkout");
    expect(next("/account/orders%3Fx%3D1")).toBe("/account/orders?x=1");
  });
});

describe("signed email links", () => {
  it("only work for the same address and purpose, and can't be forged", () => {
    const t = signEmailToken("unsubscribe", "Ada@Example.com");
    expect(verifyEmailToken("unsubscribe", "ada@example.com", t)).toBe(true);
    expect(verifyEmailToken("unsubscribe", "eve@example.com", t)).toBe(false);
    expect(verifyEmailToken("subscribe", "ada@example.com", t)).toBe(false);
    const [exp, sig] = t.split(".");
    expect(verifyEmailToken("unsubscribe", "ada@example.com", `${Number(exp) + 999}.${sig}`)).toBe(false); // extended expiry
    expect(verifyEmailToken("unsubscribe", "ada@example.com", `1.${sig}`)).toBe(false); // expired
    expect(verifyEmailToken("unsubscribe", "ada@example.com", "garbage")).toBe(false);
  });
});

describe("identity & pricing rules", () => {
  it("treats Gmail dots/+tags and phone prefixes as the same person", () => {
    expect(canonicalEmail("A.d.a+promo@GMAIL.com")).toBe("ada@gmail.com");
    expect(canonicalEmail("ada+x@googlemail.com")).toBe("ada@gmail.com");
    expect(canonicalEmail("a.da+x@yahoo.com")).toBe("a.da@yahoo.com");
    expect(phoneKey("+234 803 123 4567")).toBe(phoneKey("08031234567"));
  });

  it("charges Nigerian deliveries in naira and everything else in dollars", () => {
    expect(currencyFor("NG")).toBe("NGN");
    expect(currencyFor("GB")).toBe("USD");
  });

  it("names can't carry links or markup into emails", () => {
    for (const ok of ["Ada Obi", "Chídínmà O'Neil-Okafor", "Ọlá", "Jean-Luc Picard Jr."]) expect(PERSON_NAME.test(cleanName(ok)), ok).toBe(true);
    for (const bad of ["Visit http://evil.com", "www.evil.com", "<script>", "a", "x@y.com", "WIN ₦1,000,000 NOW", "A".repeat(81)]) expect(PERSON_NAME.test(cleanName(bad)), bad).toBe(false);
  });

  it("counts a shopper's unpaid orders (stock-hoarding cap)", async () => {
    const email = `${TAG}@example.com`;
    const phone = `+23470${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}`;
    for (let i = 0; i < 2; i++) {
      await db.insert(s.orders).values({
        number: `MLR-${randomCode(8)}`, email, currency: "NGN", subtotal: 100000, shippingFee: 0, total: 100000, stockReserved: false,
        shippingAddress: { fullName: "T", phone, line1: "1", city: "Ikeja", state: "Lagos", country: "NG" }, shippingZone: "Lagos", expiresAt: new Date(Date.now() + 1_800_000),
      });
    }
    expect(await openOrders(db, { userId: null, email: email.replace("@", "+x@") }, "no-cart")).toBe(2); // alias
    expect(await openOrders(db, { userId: null, email: "someone@else.com", phone: phone.replace("+234", "0") }, "no-cart")).toBe(2); // same phone
    expect(await openOrders(db, { userId: null, email: "someone@else.com" }, "no-cart")).toBe(0);
  });
});
