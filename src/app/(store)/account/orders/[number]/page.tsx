import Link from "next/link";
import { notFound } from "next/navigation";
import { inArray } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { getOwnedOrder } from "@/lib/account";
import type { Currency } from "@/lib/money";
import { OrderView } from "@/components/order/order-view";
import { RetryPayment } from "./retry-payment";

export default async function OrderPage({ params }: PageProps<"/account/orders/[number]">) {
  const { number } = await params;
  const { user } = await requireUser(`/account/orders/${number}`);
  const o = await getOwnedOrder(String(number).toUpperCase().slice(0, 20), user.id, user.email);
  if (!o) notFound();
  const payable = o.status === "pending" && o.expiresAt > new Date() && o.userId === user.id;
  const productIds = o.items.flatMap((i) => (i.productId ? [i.productId] : []));
  const reviewable = ["shipped", "delivered"].includes(o.status) && productIds.length
    ? await db.select({ slug: s.products.slug, name: s.products.name }).from(s.products).where(inArray(s.products.id, productIds))
    : [];
  return (
    <div className="max-w-3xl">
      <Link href="/account/orders" className="eyebrow mb-6 inline-block underline underline-offset-4">← All orders</Link>
      {payable && <RetryPayment number={o.number} />}
      <OrderView o={{ ...o, currency: o.currency as Currency, address: o.shippingAddress }} />
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
