import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { getOwnedOrder } from "@/lib/account";
import type { Currency } from "@/lib/money";
import { OrderView, progressDates } from "@/components/order/order-view";
import { BuyAgainButton } from "@/components/order/buy-again";
import { buttonOutline } from "@/components/site/section";
import { RetryPayment } from "./retry-payment";

// Fresh session check on every request, so this route blocks rather than prefetching.
export const instant = false;

export default async function OrderPage({ params }: PageProps<"/account/orders/[number]">) {
  const { number } = await params;
  const { user } = await requireUser(`/account/orders/${number}`);
  const o = await getOwnedOrder(String(number).toUpperCase().slice(0, 20), user.id, user.email);
  if (!o) notFound();
  const payable = o.status === "pending" && o.expiresAt > new Date() && o.userId === user.id;
  const productIds = o.items.flatMap((i) => (i.productId ? [i.productId] : []));
  const [events, reviewable] = await Promise.all([
    db.select({ status: s.orderEvents.status, createdAt: s.orderEvents.createdAt }).from(s.orderEvents).where(eq(s.orderEvents.orderId, o.id)).orderBy(asc(s.orderEvents.createdAt)),
    ["shipped", "delivered"].includes(o.status) && productIds.length
      ? db.select({ slug: s.products.slug, name: s.products.name }).from(s.products).where(and(inArray(s.products.id, productIds), eq(s.products.status, "active")))
      : [],
  ]);
  const canBuyAgain = !["pending", "cancelled"].includes(o.status) || o.note === "Payment window expired";
  return (
    <div className="max-w-3xl">
      <div className="mb-6 flex items-center justify-between gap-3">
        <Link href="/account/orders" className="eyebrow underline underline-offset-4">← All orders</Link>
        {canBuyAgain && <BuyAgainButton number={o.number} className={buttonOutline} />}
      </div>
      {payable && <RetryPayment number={o.number} />}
      {/* Guest checkouts linked only by email: whoever typed this email may not be the account owner, so no address/phone here. */}
      {!o.userId && <p className="mb-6 rounded-xl bg-blush p-4 text-sm">Placed as a guest checkout with your email. Delivery details are hidden for privacy. Contact us if you need them.</p>}
      <OrderView o={{ ...o, currency: o.currency as Currency, address: o.userId ? o.shippingAddress : undefined, progress: progressDates(o, events) }} />
      {reviewable.length > 0 && (
        <div className="mt-10 rounded-2xl bg-blush p-6 text-sm">
          <p className="font-heading text-xl">How’s your skin loving it?</p>
          <p className="mt-1 text-muted-foreground">Your review helps others with skin like yours.</p>
          <ul className="mt-3 flex flex-wrap gap-2">{reviewable.map((p) => <li key={p.slug}><Link href={`/products/${p.slug}#reviews`} className="eyebrow inline-block rounded-full border border-foreground px-4 py-2.5">Review {p.name}</Link></li>)}</ul>
        </div>
      )}
    </div>
  );
}
