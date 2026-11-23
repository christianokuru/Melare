import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import type { Currency } from "./money";
import { APP_URL } from "./email";

/**
 * Payment gateways behind one interface. Everything here runs on the server with SECRET keys; the browser only ever
 * receives a hosted-checkout URL. Callers must still settle through `settlePayment`, which re-checks reference,
 * provider, status, currency and exact amount against our own records.
 */
export type Provider = "paystack" | "flutterwave";
export const PROVIDER_NAME: Record<Provider, string> = { paystack: "Paystack", flutterwave: "Flutterwave" };

/** A transaction as reported by the gateway's verify API (never by a redirect or webhook body). Amount in minor units. */
export type VerifiedTx = {
  provider: Provider; id: string; reference: string; status: "successful" | "failed" | "pending"; amount: number; currency: string;
};

export type StartInput = { reference: string; amount: number; currency: Currency; email: string; name: string; phone: string };

/** Our references look like MLR-XXXXXXXX-XXXXXX; anything else is rejected before touching the DB or a gateway. */
export const PAYMENT_REF = /^MLR-[A-Z0-9]{8}-[A-Z0-9]{6}$/;

const TIMEOUT = 15_000;
const paystackKey = () => process.env.PAYSTACK_SECRET_KEY ?? "";
const flwKey = () => process.env.FLW_SECRET_KEY ?? "";

/** Currencies Paystack may charge in. Default NGN; add USD only after Paystack enables it on your business. */
function paystackCurrencies(): Currency[] {
  return (process.env.PAYSTACK_CURRENCIES ?? "NGN").split(",").map((c) => c.trim().toUpperCase()).filter((c): c is Currency => c === "NGN" || c === "USD");
}

/** Configured gateways that can charge this currency, in order of preference (Paystack first: local, lower fees). */
export function providersFor(currency: Currency): Provider[] {
  const list: Provider[] = [];
  if (/^sk_(test|live)_\w+$/.test(paystackKey()) && paystackCurrencies().includes(currency)) list.push("paystack");
  if (flwKey()) list.push("flutterwave");
  return list;
}

/** "Paystack & Flutterwave" for footer/FAQ copy. */
export function providerNames() {
  const names = [...new Set([...providersFor("NGN"), ...providersFor("USD")])].map((p) => PROVIDER_NAME[p]);
  return names.length ? names.join(" & ") : "our payment partner";
}

/** Starts a hosted checkout and returns the URL to redirect the customer to. */
export async function startPayment(provider: Provider, p: StartInput): Promise<string> {
  if (!providersFor(p.currency).includes(provider)) throw new Error(`${provider} can't charge ${p.currency}`);
  return provider === "paystack" ? paystackStart(p) : flutterwaveStart(p);
}

/** Server-to-server lookup by OUR reference. Returns null when the gateway doesn't know it (or is unreachable). */
export async function verifyPayment(provider: Provider, reference: string): Promise<VerifiedTx | null> {
  if (!PAYMENT_REF.test(reference)) return null;
  const tx = provider === "paystack" ? await paystackVerify(reference) : await flutterwaveVerify(reference);
  return tx && tx.reference === reference ? tx : null; // the gateway must echo back exactly what we asked for
}

// ── Paystack ─────────────────────────────────────────────────────────────────────────────────────────────────────

const PAYSTACK = "https://api.paystack.co";
const paystackHeaders = () => ({ Authorization: `Bearer ${paystackKey()}`, "Content-Type": "application/json" });

async function paystackStart(p: StartInput) {
  const res = await fetch(`${PAYSTACK}/transaction/initialize`, {
    method: "POST",
    headers: paystackHeaders(),
    signal: AbortSignal.timeout(TIMEOUT),
    body: JSON.stringify({
      reference: p.reference,
      amount: p.amount, // already in kobo/cents
      currency: p.currency,
      email: p.email,
      callback_url: `${APP_URL}/checkout/complete`,
      channels: p.currency === "NGN" ? ["card", "bank_transfer", "ussd", "bank"] : ["card"],
      // "Cancel" on Paystack's page brings the customer back to a clear "not completed" screen.
      metadata: { cancel_action: `${APP_URL}/checkout/complete?reference=${p.reference}`, custom_fields: [{ display_name: "Order", variable_name: "order", value: p.reference.slice(0, 12) }] },
    }),
  });
  const json = await res.json().catch(() => null);
  const url = json?.data?.authorization_url;
  if (!res.ok || json?.status !== true || typeof url !== "string" || !url.startsWith("https://checkout.paystack.com/")) {
    throw new Error(json?.message ?? `Paystack error ${res.status}`);
  }
  return url;
}

async function paystackVerify(reference: string): Promise<VerifiedTx | null> {
  if (!paystackKey()) return null;
  const res = await fetch(`${PAYSTACK}/transaction/verify/${encodeURIComponent(reference)}`, {
    headers: paystackHeaders(), cache: "no-store", signal: AbortSignal.timeout(TIMEOUT),
  });
  const json = await res.json().catch(() => null);
  const d = json?.data;
  if (!res.ok || json?.status !== true || !d) return null;
  const st = String(d.status);
  return {
    provider: "paystack", id: String(d.id), reference: String(d.reference), currency: String(d.currency),
    amount: typeof d.amount === "number" ? d.amount : NaN, // Paystack reports minor units; anything but a number never matches
    status: st === "success" ? "successful" : st === "failed" || st === "reversed" ? "failed" : "pending", // abandoned/ongoing can still complete
  };
}

/** x-paystack-signature = HMAC-SHA512(raw body, secret key), hex. Compared in constant time. */
export function isValidPaystackSignature(rawBody: string, signature: string | null) {
  const key = paystackKey();
  if (!key || !signature || !/^[a-f0-9]{128}$/i.test(signature)) return false;
  const want = createHmac("sha512", key).update(rawBody, "utf8").digest();
  return timingSafeEqual(want, Buffer.from(signature, "hex"));
}

// ── Flutterwave ──────────────────────────────────────────────────────────────────────────────────────────────────

const FLW = "https://api.flutterwave.com/v3";
const flwHeaders = () => ({ Authorization: `Bearer ${flwKey()}`, "Content-Type": "application/json" });

async function flutterwaveStart(p: StartInput) {
  const res = await fetch(`${FLW}/payments`, {
    method: "POST",
    headers: flwHeaders(),
    signal: AbortSignal.timeout(TIMEOUT),
    body: JSON.stringify({
      tx_ref: p.reference,
      amount: p.amount / 100,
      currency: p.currency,
      redirect_url: `${APP_URL}/checkout/complete`,
      payment_options: p.currency === "NGN" ? "card,banktransfer,ussd" : "card",
      session_duration: 60,
      max_retry_attempt: 5,
      customer: { email: p.email, name: p.name, phonenumber: p.phone },
      // Flutterwave fetches the logo publicly, so only send it on a real https domain (never localhost).
      customizations: { title: "Melare", description: "Skin, but rarer.", ...(APP_URL.startsWith("https://") && { logo: `${APP_URL}/icon-512.png` }) },
    }),
  });
  const json = await res.json().catch(() => null);
  if (!res.ok || json?.status !== "success" || typeof json?.data?.link !== "string") throw new Error(json?.message ?? `Flutterwave error ${res.status}`);
  return json.data.link as string;
}

async function flutterwaveVerify(reference: string): Promise<VerifiedTx | null> {
  if (!flwKey()) return null;
  const res = await fetch(`${FLW}/transactions/verify_by_reference?tx_ref=${encodeURIComponent(reference)}`, {
    headers: flwHeaders(), cache: "no-store", signal: AbortSignal.timeout(TIMEOUT),
  });
  const json = await res.json().catch(() => null);
  const d = json?.data;
  if (json?.status !== "success" || !d) return null;
  const st = String(d.status);
  return {
    provider: "flutterwave", id: String(d.id), reference: String(d.tx_ref), currency: String(d.currency),
    amount: typeof d.amount === "number" ? Math.round(d.amount * 100) : NaN, // Flutterwave reports major units
    status: st === "successful" ? "successful" : st === "failed" ? "failed" : "pending",
  };
}

/** Flutterwave sends the "secret hash" from its dashboard in verif-hash. Compared in constant time. */
export function isValidFlutterwaveHash(h: Headers) {
  const got = Buffer.from(h.get("verif-hash") ?? "");
  const want = Buffer.from(process.env.FLW_WEBHOOK_HASH ?? "");
  return want.length > 0 && got.length === want.length && timingSafeEqual(got, want);
}
