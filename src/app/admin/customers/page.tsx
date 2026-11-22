import Link from "next/link";
import { desc, ilike, or, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { EmptyState, PageTitle, Table, td, adminInput } from "@/components/admin/ui";

// Fresh admin check on every request, so this route blocks rather than prefetching.
export const instant = false;

export default async function AdminCustomers({ searchParams }: PageProps<"/admin/customers">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80).replace(/[%_\\]/g, "\\$&") : "";
  const rows = await db.select({
    id: s.user.id, name: s.user.name, email: s.user.email, phone: s.user.phone, verified: s.user.emailVerified, createdAt: s.user.createdAt,
    orders: sql<number>`(select count(*)::int from orders o where o.user_id = ${s.user.id} and o.status in ('paid','processing','shipped','delivered'))`,
    spentNgn: sql<number>`(select coalesce(sum(total),0)::int from orders o where o.user_id = ${s.user.id} and o.currency='NGN' and o.status in ('paid','processing','shipped','delivered'))`,
  }).from(s.user).where(q ? or(ilike(s.user.email, `%${q}%`), ilike(s.user.name, `%${q}%`)) : undefined).orderBy(desc(s.user.createdAt)).limit(200);
  return (
    <>
      <PageTitle title="Customers" />
      <form className="mb-4" action="/admin/customers"><label htmlFor="cq" className="sr-only">Search</label><input id="cq" name="q" defaultValue={sp.q as string} placeholder="Search name or email" className={`${adminInput} max-w-sm`} /></form>
      {!rows.length && <EmptyState>{q ? "No customers match your search." : "No customers yet."}</EmptyState>}
      {rows.length > 0 && <Table head={["Customer", "Phone", "Orders", "Spent (₦)", "Joined"]}>
        {rows.map((u) => (
          <tr key={u.id}>
            <td className={td}><Link href={`/admin/customers/${u.id}`} className="underline underline-offset-4">{u.name}</Link><span className="block text-xs text-muted-foreground">{u.email}{!u.verified && " · unverified"}</span></td>
            <td className={td}>{u.phone ?? "-"}</td><td className={td}>{u.orders}</td><td className={td}>{formatMoney(u.spentNgn, "NGN")}</td>
            <td className={td}>{u.createdAt.toLocaleDateString("en-GB")}</td>
          </tr>
        ))}
      </Table>}
    </>
  );
}
