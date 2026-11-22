import { createHmac, timingSafeEqual } from "node:crypto";

export type Provider = "paystack" | "flutterwave" | "stripe";

/** Pick gateway: NGN → Paystack (Flutterwave fallback), USD/foreign → Stripe. */
export const providerFor = (currency: string): Provider => (currency === "NGN" ? "paystack" : "stripe");

const safeEq = (a: string, b: string) =>
  a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

export async function verifyWebhook(provider: Provider, raw: string, h: Headers) {
  switch (provider) {
    case "paystack": {
      const sig = createHmac("sha512", process.env.PAYSTACK_SECRET_KEY!).update(raw).digest("hex");
      return safeEq(sig, h.get("x-paystack-signature") ?? "") ? JSON.parse(raw) : null;
    }
    case "flutterwave":
      return h.get("verif-hash") === process.env.FLW_WEBHOOK_HASH ? JSON.parse(raw) : null;
    case "stripe":
      // TODO: npm i stripe → stripe.webhooks.constructEvent(raw, h.get("stripe-signature"), STRIPE_WEBHOOK_SECRET)
      return null;
    default:
      return null;
  }
}
