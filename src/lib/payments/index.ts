import { timingSafeEqual } from "node:crypto";
import type { Currency } from "@/lib/currency";

const FLW = "https://api.flutterwave.com/v3";
const auth = { Authorization: `Bearer ${process.env.FLW_SECRET_KEY}`, "Content-Type": "application/json" };

/** Create a Flutterwave hosted-checkout link. `amount` is in minor units (kobo/cents). */
export async function initPayment(p: {
  txRef: string; amount: number; currency: Currency; email: string; name?: string; phone?: string;
}) {
  const res = await fetch(`${FLW}/payments`, {
    method: "POST",
    headers: auth,
    body: JSON.stringify({
      tx_ref: p.txRef,
      amount: p.amount / 100,
      currency: p.currency,
      redirect_url: `${process.env.NEXT_PUBLIC_APP_URL}/checkout/complete`,
      customer: { email: p.email, name: p.name, phonenumber: p.phone },
      customizations: { title: "Melaré", logo: `${process.env.NEXT_PUBLIC_APP_URL}/icon-512.png` },
    }),
  });
  const json = await res.json();
  if (json.status !== "success") throw new Error(json.message ?? "Flutterwave init failed");
  return json.data.link as string;
}

/** Always re-verify server-side before fulfilling: status, amount and currency must match the order. */
export async function verifyTransaction(transactionId: string) {
  const res = await fetch(`${FLW}/transactions/${transactionId}/verify`, { headers: auth, cache: "no-store" });
  const json = await res.json();
  return json.status === "success"
    ? (json.data as { status: string; tx_ref: string; amount: number; currency: string; id: number })
    : null;
}

export function verifyWebhook(h: Headers) {
  const got = h.get("verif-hash") ?? "";
  const want = process.env.FLW_WEBHOOK_HASH ?? "";
  return !!want && got.length === want.length && timingSafeEqual(Buffer.from(got), Buffer.from(want));
}
