import Link from "next/link";
import { and, desc, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { formatMoney, type Currency } from "@/lib/money";
import { PAID_STATUSES } from "@/lib/order-status";
import { PUSH_PUBLIC_KEY, pushEnabled } from "@/lib/push";
import { EmptyState, PageTitle, Table, td, adminGhost } from "@/components/admin/ui";
import { PushToggle } from "@/components/admin/push-toggle";
import { StatusBadge } from "@/components/order/order-view";
import { cn } from "@/lib/utils";

// Fresh admin check on every request, so this route blocks rather than prefetching.
export const instant = false;

const RANGES = [7, 30, 90] as const;

export default async function AdminHome({ searchParams }: PageProps<"/admin">) {
  const { user } = await requireAdmin();
  const sp = await searchParams;
  const days = RANGES.find((r) => String(r) === sp.range) ?? 30;
  const cur: Currency = sp.cur === "USD" ? "USD" : "NGN";
  const since = sql`now() - make_interval(days => ${days})`;
  const paidInRange = and(inArray(s.orders.status, [...PAID_STATUSES]), gte(s.orders.paidAt, since));

  const [revenue, [toShip], lowStock, recent, [customers], [pendingReviews], daily, best] = await Promise.all([
    db.select({ currency: s.orders.currency, total: sql<number>`coalesce(sum(${s.orders.total}),0)::int`, count: sql<number>`count(*)::int` })
      .from(s.orders).where(paidInRange).groupBy(s.orders.currency),
    db.select({ n: sql<number>`count(*)::int` }).from(s.orders).where(inArray(s.orders.status, ["paid", "processing"])),
    db.select({ id: s.productVariants.id, label: s.productVariants.label, stock: s.productVariants.stock, name: s.products.name, productId: s.products.id })
      .from(s.productVariants).innerJoin(s.products, eq(s.products.id, s.productVariants.productId))
      .where(and(lte(s.productVariants.stock, 5), eq(s.products.status, "active"))).orderBy(s.productVariants.stock).limit(8),
    db.select().from(s.orders).orderBy(desc(s.orders.createdAt)).limit(8),
    db.select({ total: sql<number>`count(*)::int`, fresh: sql<number>`(count(*) filter (where ${s.user.createdAt} >= ${since}))::int` }).from(s.user),
    db.select({ n: sql<number>`count(*)::int` }).from(s.reviews).where(eq(s.reviews.approved, false)),
    // One row per day (Lagos time), zero-filled, for the chart.
    db.execute<{ day: string; total: number; orders: number }>(sql`
      select to_char(d, 'YYYY-MM-DD') as day, coalesce(sum(o.total), 0)::int as total, count(o.id)::int as orders
      from generate_series((now() at time zone 'Africa/Lagos')::date - (${days}::int - 1), (now() at time zone 'Africa/Lagos')::date, interval '1 day') d
      left join orders o on (o.paid_at at time zone 'Africa/Lagos')::date = d::date and o.currency = ${cur}
        and o.status in ('paid', 'processing', 'shipped', 'delivered')
      group by d order by d`),
    db.select({ name: s.orderItems.name, qty: sql<number>`sum(${s.orderItems.quantity})::int` })
      .from(s.orderItems).innerJoin(s.orders, eq(s.orders.id, s.orderItems.orderId)).where(paidInRange)
      .groupBy(s.orderItems.name).orderBy(desc(sql`sum(${s.orderItems.quantity})`)).limit(5),
  ]);

  const rev = (c: Currency) => revenue.find((r) => r.currency === c) ?? { total: 0, count: 0 };
  const orderCount = revenue.reduce((n, r) => n + r.count, 0);
  const aov = rev(cur).count ? Math.round(rev(cur).total / rev(cur).count / 100) * 100 : 0; // whole naira/dollars
  const points = daily.rows;
  const max = Math.max(1, ...points.map((p) => p.total));
  const link = (p: { range?: number; cur?: Currency }) => `/admin?range=${p.range ?? days}&cur=${p.cur ?? cur}`;
  const stat = (label: string, value: React.ReactNode, sub?: string, href?: string) => {
    const body = <><p className="eyebrow text-muted-foreground">{label}</p><p className="mt-2 font-heading text-3xl">{value}</p>{sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}</>;
    return href ? <Link href={href} className="rounded-2xl border bg-white p-5 hover:border-foreground">{body}</Link> : <div className="rounded-2xl border bg-white p-5">{body}</div>;
  };
  const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><p className="text-sm text-muted-foreground">Hello, {user.name.split(" ")[0]}</p><PageTitle title="Dashboard" /></div>
        <nav aria-label="Date range" className="mb-6 flex gap-1 rounded-full border bg-white p-1">
          {RANGES.map((r) => <Link key={r} href={link({ range: r })} aria-current={r === days ? "page" : undefined} className={cn("rounded-full px-4 py-1.5 text-xs", r === days ? "bg-foreground text-background" : "hover:bg-blush")}>{r} days</Link>)}
        </nav>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
        {stat("Revenue · NGN", formatMoney(rev("NGN").total, "NGN"), `${rev("NGN").count} orders`)}
        {stat("Revenue · USD", formatMoney(rev("USD").total, "USD"), `${rev("USD").count} orders`)}
        {stat("Orders", orderCount, `last ${days} days`, "/admin/orders")}
        {stat(`Average order · ${cur}`, formatMoney(aov, cur))}
        {stat("To ship", toShip.n, "paid or preparing", "/admin/orders?status=paid")}
        {stat("Customers", customers.total, `${customers.fresh} new`, "/admin/customers")}
      </div>
      {pendingReviews.n > 0 && <Link href="/admin/reviews" className="mt-4 block rounded-2xl bg-[#f6ead2] p-4 text-sm">{pendingReviews.n} review(s) waiting for approval →</Link>}

      <div className="mt-6 grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
        <div className="grid min-w-0 gap-6">
          <section className="rounded-2xl border bg-white p-5" aria-labelledby="sales-title">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 id="sales-title" className="font-heading text-2xl">Sales · last {days} days</h2>
              <div className="flex items-center gap-3">
                <span className="text-sm">{formatMoney(rev(cur).total, cur)}</span>
                <span className="flex gap-1 rounded-full border p-0.5">{(["NGN", "USD"] as const).map((c) => <Link key={c} href={link({ cur: c })} className={cn("rounded-full px-3 py-1 text-[11px]", c === cur ? "bg-foreground text-background" : "")}>{c}</Link>)}</span>
              </div>
            </div>
            <div className="flex h-44 items-end gap-[2px]" role="img" aria-label={`Daily ${cur} revenue for the last ${days} days`}>
              {points.map((p) => (
                <div key={p.day} title={`${fmtDay(p.day)} · ${formatMoney(p.total, cur)} · ${p.orders} order${p.orders === 1 ? "" : "s"}`}
                  className="group flex h-full flex-1 items-end">
                  <div className={cn("w-full rounded-t-[3px] transition-colors", p.total ? "bg-[#c98b74] group-hover:bg-foreground" : "bg-sand")} style={{ height: `${p.total ? Math.max(4, (p.total / max) * 100) : 2}%` }} />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-between text-[11px] text-muted-foreground"><span>{points[0] && fmtDay(points[0].day)}</span><span>Today</span></div>
          </section>

          <section className="min-w-0">
            <div className="mb-3 flex items-baseline justify-between"><h2 className="font-heading text-2xl">Recent orders</h2><Link href="/admin/orders" className="text-xs underline underline-offset-4">View all</Link></div>
            {recent.length ? (
              <Table head={["Order", "Customer", "Status", "Total", "Date"]}>
                {recent.map((o) => (
                  <tr key={o.id}>
                    <td className={td}><Link href={`/admin/orders/${o.id}`} className="underline underline-offset-4">{o.number}</Link></td>
                    <td className={td}>{o.shippingAddress.fullName}<span className="block text-xs text-muted-foreground">{o.email}</span></td>
                    <td className={td}><StatusBadge status={o.status} /></td>
                    <td className={td}>{formatMoney(o.total, o.currency as Currency)}</td><td className={td}>{o.createdAt.toLocaleDateString("en-GB")}</td>
                  </tr>
                ))}
              </Table>
            ) : <EmptyState>No orders yet. Share your store link to get your first sale.</EmptyState>}
          </section>
        </div>

        <div className="grid gap-6">
          <section className="rounded-2xl border bg-white p-5">
            <h2 className="mb-2 font-heading text-2xl">Best sellers</h2>
            {best.length ? (
              <ol className="divide-y text-sm">
                {best.map((b, i) => <li key={b.name} className="flex justify-between gap-3 py-2.5"><span><span className="mr-2 text-muted-foreground">{i + 1}</span>{b.name}</span><span className="shrink-0 text-muted-foreground">{b.qty} sold</span></li>)}
              </ol>
            ) : <p className="text-sm text-muted-foreground">No sales in this period yet.</p>}
          </section>
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
          {pushEnabled() && <PushToggle publicKey={PUSH_PUBLIC_KEY} />}
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
