import Link from "next/link";
import { notFound } from "next/navigation";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { ownedBy } from "@/lib/account";
import { formatMoney, type Currency } from "@/lib/money";
import { PAID_STATUSES } from "@/lib/order-status";
import { COUNTRIES, whatsappLink } from "@/lib/constants";
import { EmptyState, Table, td } from "@/components/admin/ui";
import { StatusBadge } from "@/components/order/order-view";

export const instant = false;

export default async function AdminCustomer({ params }: PageProps<"/admin/customers/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!z.string().min(1).max(64).safeParse(id).success) notFound();
  const [u] = await db.select().from(s.user).where(eq(s.user.id, id));
  if (!u) notFound();
  const owned = ownedBy(u.id, u.email);
  const [orders, spent, addresses, [quiz], [reviews]] = await Promise.all([
    db.select().from(s.orders).where(owned).orderBy(desc(s.orders.createdAt)).limit(50),
    db.select({ currency: s.orders.currency, total: sql<number>`sum(${s.orders.total})::int`, n: sql<number>`count(*)::int` })
      .from(s.orders).where(and(owned, inArray(s.orders.status, [...PAID_STATUSES]))).groupBy(s.orders.currency),
    db.select().from(s.addresses).where(eq(s.addresses.userId, u.id)),
    db.select().from(s.quizResults).where(eq(s.quizResults.userId, u.id)).orderBy(desc(s.quizResults.createdAt)).limit(1),
    db.select({ n: sql<number>`count(*)::int` }).from(s.reviews).where(eq(s.reviews.userId, u.id)),
  ]);
  const total = (c: Currency) => spent.find((x) => x.currency === c)?.total ?? 0;
  const paidOrders = spent.reduce((n, x) => n + x.n, 0);
  const answers = quiz?.answers as { skinType?: string; concerns?: string[] } | undefined;
  const card = "rounded-2xl border bg-white p-5";
  return (
    <div className="grid gap-6">
      <Link href="/admin/customers" className="eyebrow underline underline-offset-4">← Customers</Link>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-heading text-4xl">{u.name}</h1>
          <p className="text-sm text-muted-foreground">{u.email}{!u.emailVerified && " · unverified"} · joined {u.createdAt.toLocaleDateString("en-GB", { dateStyle: "medium" })}</p>
        </div>
        <div className="flex gap-2 text-xs">
          <a href={`mailto:${u.email}`} className="rounded-full border px-3 py-2 hover:bg-blush">Email</a>
          {u.phone && <a href={whatsappLink(u.phone, `Hi ${u.name.split(" ")[0]}, it’s Melaré.`)} target="_blank" rel="noopener noreferrer" className="rounded-full border px-3 py-2 hover:bg-blush">WhatsApp</a>}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[["Paid orders", paidOrders], ["Spent · NGN", formatMoney(total("NGN"), "NGN")], ["Spent · USD", formatMoney(total("USD"), "USD")], ["Reviews", reviews.n]].map(([k, v]) => (
          <div key={k as string} className={card}><p className="eyebrow text-muted-foreground">{k}</p><p className="mt-2 font-heading text-3xl">{v}</p></div>
        ))}
      </div>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]">
        <section className="min-w-0">
          <h2 className="mb-3 font-heading text-2xl">Orders</h2>
          {orders.length ? (
            <Table head={["Order", "Status", "Total", "Placed"]}>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className={td}><Link href={`/admin/orders/${o.id}`} className="underline underline-offset-4">{o.number}</Link></td>
                  <td className={td}><StatusBadge status={o.status} /></td>
                  <td className={td}>{formatMoney(o.total, o.currency as Currency)}</td>
                  <td className={td}>{o.createdAt.toLocaleDateString("en-GB")}</td>
                </tr>
              ))}
            </Table>
          ) : <EmptyState>No orders yet.</EmptyState>}
        </section>
        <div className="grid gap-6">
          <section className={card}>
            <h2 className="mb-3 font-heading text-2xl">Details</h2>
            <dl className="grid gap-2 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Phone</dt><dd>{u.phone ?? "-"}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Referral code</dt><dd>{u.referralCode ?? "-"}</dd></div>
              {answers?.skinType && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Skin type</dt><dd>{answers.skinType}</dd></div>}
              {answers?.concerns?.length ? <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Concerns</dt><dd className="text-right">{answers.concerns.join(", ").replace(/-/g, " ")}</dd></div> : null}
            </dl>
          </section>
          <section className={card}>
            <h2 className="mb-3 font-heading text-2xl">Addresses</h2>
            {addresses.length ? (
              <ul className="grid gap-3 text-sm">
                {addresses.map((a) => (
                  <li key={a.id}>{a.fullName}{a.isDefault && <span className="ml-2 text-xs text-muted-foreground">default</span>}<span className="block text-muted-foreground">{a.line1}, {a.city}, {a.state}, {COUNTRIES[a.country] ?? a.country} · {a.phone}</span></li>
                ))}
              </ul>
            ) : <p className="text-sm text-muted-foreground">No saved addresses.</p>}
          </section>
        </div>
      </div>
    </div>
  );
}
