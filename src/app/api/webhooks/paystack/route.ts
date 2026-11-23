import { revalidateTag } from "next/cache";
import { isValidPaystackSignature, PAYMENT_REF, verifyPayment } from "@/lib/gateways";
import { settlePayment } from "@/lib/payments";
import { CATALOG_TAG } from "@/lib/catalog";

const MAX_BODY = 64 * 1024;

// POST /api/webhooks/paystack
// 1) HMAC-SHA512 signature over the RAW body must match  2) never trust the body: re-verify with Paystack by OUR reference
// 3) settle idempotently (Paystack retries; duplicates are no-ops). A DB error throws → 500 → Paystack retries later.
export async function POST(req: Request) {
  if (Number(req.headers.get("content-length") ?? 0) > MAX_BODY) return new Response("Too large", { status: 413 });
  const raw = await req.text();
  if (raw.length > MAX_BODY || !isValidPaystackSignature(raw, req.headers.get("x-paystack-signature"))) {
    return new Response("Unauthorized", { status: 401 });
  }
  let body: { event?: unknown; data?: { reference?: unknown } } | null = null;
  try { body = JSON.parse(raw); } catch { /* signed but malformed: acknowledge and ignore */ }
  const ref = body?.data?.reference;
  if (typeof body?.event !== "string" || !body.event.startsWith("charge.") || typeof ref !== "string" || !PAYMENT_REF.test(ref)) return new Response("ok");
  const tx = await verifyPayment("paystack", ref);
  if (!tx) return new Response("ok");
  const result = await settlePayment(tx);
  if (result.status === "paid") revalidateTag(CATALOG_TAG, "max");
  return new Response("ok");
}
