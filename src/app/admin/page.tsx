import Link from "next/link";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { formatMoney, type Currency } from "@/lib/money";
import { PageTitle, Table, td, adminGhost } from "@/components/admin/ui";
import { StatusBadge } from "@/components/order/order-view";

// Fresh admin check on every request, so this route blocks rather than prefetching.
export const instant = false;

const PAID = ["paid", "processing", "shipped", "delivered"] as const;

export default async function AdminHome() {
  await requireAdmin();
  const [revenue, toShip, lowStock, recent, customers, pendingReviews] = await Promise.all([
    db.select({ currency: s.orders.currency, total: sql<number>`coalesce(sum(${s.orders.total}),0)::int`, count: sql<number>`count(*)::int` })
      .from(s.orders).where(and(inArray(s.orders.status, [...PAID]), gte(s.orders.paidAt, sql`now() - interval '30 days'`))).groupBy(s.orders.currency),
    db.select({ n: sql<number>`count(*)::int` }).from(s.orders).where(inArray(s.orders.status, ["paid", "processing"])),
    db.select({ id: s.productVariants.id, sku: s.productVariants.sku, label: s.productVariants.label, stock: s.productVariants.stock, name: s.products.name, productId: s.products.id })
      .from(s.productVariants).innerJoin(s.products, eq(s.products.id, s.productVariants.productId))
      .where(and(lte(s.productVariants.stock, 5), eq(s.products.status, "active"))).orderBy(s.productVariants.stock),
    db.select().from(s.orders).orderBy(desc(s.orders.createdAt)).limit(8),
    db.select({ n: sql<number>`count(*)::int` }).from(s.user),
    db.select({ n: sql<number>`count(*)::int` }).from(s.reviews).where(eq(s.reviews.approved, false)),
  ]);
  const stat = (label: string, value: React.ReactNode, href?: string) => {
    const body = <><p className="eyebrow text-muted-foreground">{label}</p><p className="mt-2 font-heading text-3xl">{value}</p></>;
    return href ? <Link href={href} className="rounded-2xl border bg-white p-5 hover:border-foreground">{body}</Link> : <div className="rounded-2xl border bg-white p-5">{body}</div>;
  };
  const rev = (c: Currency) => revenue.find((r) => r.currency === c);
  return (
    <>
      <PageTitle title="Dashboard" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stat("Revenue 30d · NGN", formatMoney(rev("NGN")?.total ?? 0, "NGN"))}
        {stat("Revenue 30d · USD", formatMoney(rev("USD")?.total ?? 0, "USD"))}
        {stat("Orders to ship", toShip[0].n, "/admin/orders?status=paid")}
        {stat("Customers", customers[0].n, "/admin/customers")}
      </div>
      {pendingReviews[0].n > 0 && <Link href="/admin/reviews" className="mt-4 block rounded-2xl bg-[#f6ead2] p-4 text-sm">{pendingReviews[0].n} review(s) waiting for approval →</Link>}
      {/* Full width on big screens: orders on the left, stock + insights on the right. */}
      <div className="mt-8 grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <section className="min-w-0">
          <div className="mb-3 flex items-baseline justify-between"><h2 className="font-heading text-2xl">Recent orders</h2><Link href="/admin/orders" className="text-xs underline underline-offset-4">View all</Link></div>
          <Table head={["Order", "Customer", "Status", "Total", "Date"]}>
            {recent.map((o) => (
              <tr key={o.id}>
                <td className={td}><Link href={`/admin/orders/${o.id}`} className="underline underline-offset-4">{o.number}</Link></td>
                <td className={td}>{o.email}</td><td className={td}><StatusBadge status={o.status} /></td>
                <td className={td}>{formatMoney(o.total, o.currency as Currency)}</td><td className={td}>{o.createdAt.toLocaleString("en-GB")}</td>
              </tr>
            ))}
          </Table>
        </section>
        <div className="grid gap-6">
          <section className="rounded-2xl border bg-white p-5">
            <h2 className="mb-2 font-heading text-2xl">Low stock</h2>
            {lowStock.length ? (
              <ul className="divide-y text-sm">
                {lowStock.map((v) => (
                  <li key={v.id} className="flex justify-between gap-3 py-2.5">
                    <Link href={`/admin/products/${v.productId}`} className="hover:underline">{v.name} <span className="text-muted-foreground">· {v.label}</span></Link>
                    <span className="shrink-0 text-destructive">{v.stock ? `${v.stock} left` : "Sold out"}</span>
                  </li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">All products are well stocked.</p>}
          </section>
          <section className="rounded-2xl border bg-white p-5">
            <h2 className="mb-3 font-heading text-2xl">Insights</h2>
            <div className="grid gap-2">
              <a href="https://analytics.google.com/analytics/web/" target="_blank" rel="noopener noreferrer" className={adminGhost}>Visitors & sales · Google Analytics ↗</a>
              <a href={process.env.NEXT_PUBLIC_CLARITY_ID ? `https://clarity.microsoft.com/projects/view/${encodeURIComponent(process.env.NEXT_PUBLIC_CLARITY_ID)}/dashboard` : "https://clarity.microsoft.com/"} target="_blank" rel="noopener noreferrer" className={adminGhost}>Recordings & heatmaps · Clarity ↗</a>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
