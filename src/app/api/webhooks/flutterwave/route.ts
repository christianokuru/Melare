import { verifyTransaction, verifyWebhook } from "@/lib/payments";

// POST /api/webhooks/flutterwave
export async function POST(req: Request) {
  if (!verifyWebhook(req.headers)) return new Response("Invalid signature", { status: 401 });
  const event = await req.json();
  if (event?.event === "charge.completed" && event.data?.id) {
    const tx = await verifyTransaction(String(event.data.id));
    if (tx?.status === "successful") {
      // TODO: find payment by tx.tx_ref → check amount/currency match order →
      // db.batch([payments → success, orders → paid, product_variants.stock -= qty]) (skip if already success)
    }
  }
  return new Response("ok"); // always 200 quickly so Flutterwave doesn't retry
}
