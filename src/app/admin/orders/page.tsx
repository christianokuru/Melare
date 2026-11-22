import Link from "next/link";
import { desc, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { formatMoney, type Currency } from "@/lib/money";
import { orderWhere, ordersQuery, parseOrderFilters } from "@/lib/admin-orders";
import { STATUS_LABEL } from "@/lib/order-status";
import { EmptyState, PageTitle, Table, td, adminButton, adminGhost, adminInput, adminLabel } from "@/components/admin/ui";
import { StatusBadge } from "@/components/order/order-view";
import { cn } from "@/lib/utils";
import { BulkOrders } from "./bulk-orders";

// Fresh admin check on every request, so this route blocks rather than prefetching.
export const instant = false;

const PER_PAGE = 30;

export default async function AdminOrders({ searchParams }: PageProps<"/admin/orders">) {
  await requireAdmin();
  const sp = await searchParams;
  const f = parseOrderFilters(sp);
  const page = Math.max(1, Math.min(1000, Number(sp.page) || 1));
  const [orders, counts] = await Promise.all([
    db.select().from(s.orders).where(orderWhere(f)).orderBy(desc(s.orders.createdAt)).limit(PER_PAGE + 1).offset((page - 1) * PER_PAGE),
    db.select({ status: s.orders.status, n: sql<number>`count(*)::int` }).from(s.orders).where(orderWhere(f, false)).groupBy(s.orders.status),
  ]);
  const total = counts.reduce((n, c) => n + c.n, 0);
  const href = (extra: Record<string, string | number | undefined>) => `/admin/orders?${ordersQuery(f, extra)}`;
  const filtered = !!(f.q || f.from || f.to);

  return (
    <>
      <PageTitle title="Orders" />
      <form className="mb-4 flex flex-wrap items-end gap-2" action="/admin/orders">
        {f.status && <input type="hidden" name="status" value={f.status} />}
        <div className="w-full sm:w-80"><label htmlFor="oq" className={adminLabel}>Search</label><input id="oq" name="q" defaultValue={f.q} placeholder="Order number, name, email or phone" className={adminInput} /></div>
        <div><label htmlFor="ofrom" className={adminLabel}>From</label><input id="ofrom" type="date" name="from" defaultValue={f.from} className={adminInput} /></div>
        <div><label htmlFor="oto" className={adminLabel}>To</label><input id="oto" type="date" name="to" defaultValue={f.to} className={adminInput} /></div>
        <button type="submit" className={adminButton}>Filter</button>
        {filtered && <Link href={href({ q: undefined, from: undefined, to: undefined })} className="h-10 px-2 py-2.5 text-xs underline">Clear</Link>}
        <a href={`/admin/orders/export?${ordersQuery(f)}`} className={`${adminGhost} ml-auto`} download>Export CSV</a>
      </form>

      <nav aria-label="Filter by status" className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        {[["", "All", total] as const, ...Object.entries(STATUS_LABEL).map(([k, v]) => [k, v, counts.find((c) => c.status === k)?.n ?? 0] as const)].map(([k, label, n]) => {
          const active = (f.status ?? "") === k;
          return (
            <Link key={k} href={href({ status: k || undefined, page: undefined })} aria-current={active ? "page" : undefined}
              className={cn("flex shrink-0 items-center gap-1.5 rounded-full border px-4 py-1.5 text-xs", active && "bg-foreground text-background")}>
              {label}<span className={cn("rounded-full px-1.5 text-[10px]", active ? "bg-background/20" : "bg-blush")}>{n}</span>
            </Link>
          );
        })}
      </nav>

      {orders.length ? (
        <BulkOrders>
          <Table head={[<input key="all" type="checkbox" data-select-all aria-label="Select all orders on this page" className="size-4 accent-foreground" />, "Order", "Customer", "Ship to", "Status", "Total", "Placed"]}>
            {orders.slice(0, PER_PAGE).map((o) => (
              <tr key={o.id} className={o.note ? "bg-[#fbf3e3]" : ""}>
                <td className={`${td} w-10`}><input type="checkbox" name="ids" value={o.id} aria-label={`Select ${o.number}`} className="size-4 accent-foreground" /></td>
                <td className={td}><Link href={`/admin/orders/${o.id}`} className="underline underline-offset-4">{o.number}</Link>{o.note && <span className="block text-xs text-[#8a5a17]">⚠ {o.note}</span>}</td>
                <td className={td}>{o.shippingAddress.fullName}<span className="block text-xs text-muted-foreground">{o.email}</span></td>
                <td className={td}>{o.shippingAddress.city}, {o.shippingAddress.state}</td>
                <td className={td}><StatusBadge status={o.status} /></td>
                <td className={td}>{formatMoney(o.total, o.currency as Currency)}</td>
                <td className={td}>{o.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</td>
              </tr>
            ))}
          </Table>
        </BulkOrders>
      ) : <EmptyState>{filtered || f.status ? "No orders match these filters." : "No orders yet."}</EmptyState>}

      <div className="mt-4 flex justify-between text-sm">
        {page > 1 ? <Link href={href({ page: page - 1 })} className="underline">← Newer</Link> : <span />}
        {orders.length > PER_PAGE && <Link href={href({ page: page + 1 })} className="underline">Older →</Link>}
      </div>
    </>
  );
}
