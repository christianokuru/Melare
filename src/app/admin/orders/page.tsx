import Link from "next/link";
import { and, desc, eq, ilike, or, type SQL } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { formatMoney, type Currency } from "@/lib/money";
import { PageTitle, Table, td, adminInput } from "@/components/admin/ui";
import { StatusBadge, STATUS_LABEL } from "@/components/order/order-view";
import { cn } from "@/lib/utils";

const PER_PAGE = 30;

export default async function AdminOrders({ searchParams }: PageProps<"/admin/orders">) {
  await requireAdmin();
  const sp = await searchParams;
  const status = typeof sp.status === "string" && sp.status in STATUS_LABEL ? sp.status : undefined;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const page = Math.max(1, Math.min(1000, Number(sp.page) || 1));
  const where: SQL[] = [];
  if (status) where.push(eq(s.orders.status, status as (typeof s.orderStatus.enumValues)[number]));
  if (q) where.push(or(ilike(s.orders.number, `%${q.replace(/[%_\\]/g, "\\$&")}%`), ilike(s.orders.email, `%${q.replace(/[%_\\]/g, "\\$&")}%`))!);
  const orders = await db.select().from(s.orders).where(where.length ? and(...where) : undefined).orderBy(desc(s.orders.createdAt)).limit(PER_PAGE + 1).offset((page - 1) * PER_PAGE);
  const qs = (p: Record<string, string | number | undefined>) => `/admin/orders?${new URLSearchParams(Object.entries({ status, q: q || undefined, ...p }).filter(([, v]) => v != null && v !== "").map(([k, v]) => [k, String(v)]))}`;
  return (
    <>
      <PageTitle title="Orders" />
      <form className="mb-4 flex flex-wrap gap-2" action="/admin/orders">
        {status && <input type="hidden" name="status" value={status} />}
        <label htmlFor="oq" className="sr-only">Search orders</label>
        <input id="oq" name="q" defaultValue={q} placeholder="Search order number or email" className={`${adminInput} max-w-sm`} />
      </form>
      <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto">
        <Link href={qs({ status: undefined, page: undefined })} className={cn("shrink-0 rounded-full border px-4 py-1.5 text-xs", !status && "bg-foreground text-background")}>All</Link>
        {Object.entries(STATUS_LABEL).map(([k, v]) => <Link key={k} href={qs({ status: k, page: undefined })} className={cn("shrink-0 rounded-full border px-4 py-1.5 text-xs", status === k && "bg-foreground text-background")}>{v}</Link>)}
      </div>
      <Table head={["Order", "Customer", "Ship to", "Status", "Total", "Placed"]}>
        {orders.slice(0, PER_PAGE).map((o) => (
          <tr key={o.id} className={o.note ? "bg-[#fbf3e3]" : ""}>
            <td className={td}><Link href={`/admin/orders/${o.id}`} className="underline underline-offset-4">{o.number}</Link>{o.note && <span className="block text-xs text-[#8a5a17]">⚠ {o.note}</span>}</td>
            <td className={td}>{o.shippingAddress.fullName}<span className="block text-xs text-muted-foreground">{o.email}</span></td>
            <td className={td}>{o.shippingAddress.city}, {o.shippingAddress.state}</td>
            <td className={td}><StatusBadge status={o.status} /></td>
            <td className={td}>{formatMoney(o.total, o.currency as Currency)}</td>
            <td className={td}>{o.createdAt.toLocaleString("en-GB")}</td>
          </tr>
        ))}
      </Table>
      {!orders.length && <p className="mt-4 text-sm text-muted-foreground">No orders found.</p>}
      <div className="mt-4 flex justify-between text-sm">
        {page > 1 ? <Link href={qs({ page: page - 1 })} className="underline">← Newer</Link> : <span />}
        {orders.length > PER_PAGE && <Link href={qs({ page: page + 1 })} className="underline">Older →</Link>}
      </div>
    </>
  );
}
