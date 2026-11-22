import { verifyWebhook, type Provider } from "@/lib/payments";

// POST /api/webhooks/paystack | flutterwave | stripe
// Verify signature → find payment by reference → idempotently mark payment + order paid → decrement stock.
export async function POST(req: Request, ctx: RouteContext<"/api/webhooks/[provider]">) {
  const { provider } = await ctx.params;
  const raw = await req.text();
  const event = await verifyWebhook(provider as Provider, raw, req.headers);
  if (!event) return new Response("Invalid signature", { status: 401 });
  // TODO: db.batch([...update payments, orders, product_variants.stock])
  return new Response("ok");
}
