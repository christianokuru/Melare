import { revalidateTag } from "next/cache";
import { isValidFlutterwaveHash, PAYMENT_REF, verifyPayment } from "@/lib/gateways";
import { settlePayment } from "@/lib/payments";
import { CATALOG_TAG } from "@/lib/catalog";

// POST /api/webhooks/flutterwave
// 1) secret hash must match  2) never trust the body: re-verify with Flutterwave by OUR reference  3) settle idempotently
export async function POST(req: Request) {
  if (!isValidFlutterwaveHash(req.headers)) return new Response("Unauthorized", { status: 401 });
  const body = await req.json().catch(() => null);
  const ref = body?.data?.tx_ref ?? body?.txRef;
  if (typeof ref !== "string" || !PAYMENT_REF.test(ref)) return new Response("ok");
  const tx = await verifyPayment("flutterwave", ref);
  if (!tx) return new Response("ok");
  const result = await settlePayment(tx);
  if (result.status === "paid") revalidateTag(CATALOG_TAG, "max");
  return new Response("ok");
}
