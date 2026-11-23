import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { settlePayment } from "@/lib/payments";
import { PAYMENT_REF, verifyPayment, type Provider } from "@/lib/gateways";
import { throttle } from "@/lib/throttle";
import { formatMoney, type Currency } from "@/lib/money";
import { buttonOutline, buttonPrimary, container } from "@/components/site/section";
import { PurchaseTracker } from "@/components/checkout/purchase-tracker";
import { ScrubUrl } from "@/components/scrub-url";

export const metadata: Metadata = { title: "Order status", robots: { index: false, follow: false } };

export default function CompletePage({ searchParams }: PageProps<"/checkout/complete">) {
  return (
    <div className={`${container} max-w-2xl py-16 text-center`} data-clarity-mask="True">
      <ScrubUrl />
      <Suspense fallback={<p className="text-muted-foreground">Confirming your payment…</p>}><Result searchParams={searchParams} /></Suspense>
    </div>
  );
}

async function Result({ searchParams }: { searchParams: PageProps<"/checkout/complete">["searchParams"] }) {
  const q = await searchParams;
  const raw = q.tx_ref ?? q.reference; // Flutterwave: tx_ref · Paystack: reference (and trxref)
  const ref = typeof raw === "string" && PAYMENT_REF.test(raw) ? raw : null;
  const [payment] = ref ? await db.select().from(s.payments).where(eq(s.payments.reference, ref)) : [];
  if (!payment) return <Message title="We couldn’t find that payment" body="If you were charged, don’t worry: you’ll receive a confirmation email shortly. Otherwise, please try again from your bag." />;

  // Verify server-to-server (the redirect's own status parameter is ignored), but only while the payment is still open
  // and within a per-IP budget, so reloading/hammering this URL can't burn our gateway API quota.
  // The gateway is taken from OUR record of the payment, never from the URL.
  const open = payment.status !== "success" && (await throttle("verify-pay", 30, 600)); // a failed attempt can still succeed on retry
  const tx = open ? await verifyPayment(payment.provider as Provider, payment.reference) : null;
  const result = tx ? await settlePayment(tx) : { status: payment.status === "success" ? "paid" : payment.status === "failed" ? "failed" : "pending" as const };
  const [order] = await db.select().from(s.orders).where(eq(s.orders.id, payment.orderId));
  const c = order.currency as Currency;

  if (result.status === "paid") {
    const items = await db.select().from(s.orderItems).where(eq(s.orderItems.orderId, order.id));
    return (
      <>
        <p className="eyebrow text-muted-foreground">Order {order.number}</p>
        <h1 className="mt-3 font-heading text-[44px] leading-none">Thank you ✦</h1>
        <p className="mt-4 text-muted-foreground">Your payment of {formatMoney(order.total, c)} was successful. We’ve emailed your receipt to {maskEmail(order.email)} and we’ll let you know as soon as your order ships ({order.shippingZone}).</p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href={order.userId ? `/account/orders/${order.number}` : "/track"} className={buttonPrimary}>View order</Link>
          <Link href="/shop" className={buttonOutline}>Continue shopping</Link>
        </div>
        <PurchaseTracker orderNumber={order.number} currency={c} value={order.total / 100}
          items={items.map((i) => ({ item_id: i.productId ?? i.bundleId ?? i.id, item_name: i.name, price: i.unitPrice / 100, quantity: i.quantity }))} />
      </>
    );
  }
  if (result.status === "pending") return <Message title="Payment processing" body={`We’re waiting for confirmation from your bank for order ${order.number}. This can take a few minutes for transfers and USSD. You’ll get an email as soon as it’s confirmed.`} />;
  return <Message title="Payment not completed" body={`Your payment for order ${order.number} didn’t go through and you have not been charged. Your items are still reserved for a short time.`} retry />;
}

/** "ada.obi@gmail.com" → "a•••@gmail.com": anyone holding the link mustn’t learn the buyer’s email. */
const maskEmail = (e: string) => `${e[0]}•••@${e.split("@")[1]}`;

function Message({ title, body, retry }: { title: string; body: string; retry?: boolean }) {
  return (
    <>
      <h1 className="font-heading text-[40px] leading-none">{title}</h1>
      <p className="mt-4 text-muted-foreground">{body}</p>
      <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
        <Link href={retry ? "/checkout" : "/"} className={buttonPrimary}>{retry ? "Try again" : "Back to home"}</Link>
        <Link href="/contact" className={buttonOutline}>Contact us</Link>
      </div>
    </>
  );
}
