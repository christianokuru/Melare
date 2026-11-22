import { and, desc, eq, exists, gt, lt, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { getCartLines } from "@/lib/cart";
import { formatMoney } from "@/lib/money";
import { whatsappLink } from "@/lib/constants";
import { EmptyState, PageTitle, Table, td } from "@/components/admin/ui";

export const instant = false;
export const metadata = { title: "Abandoned bags" };

/** Bags with items, untouched for 1h+ in the last 30 days. Paid orders empty their bag, so these never converted. */
export default async function AbandonedBags() {
  await requireAdmin();
  const carts = await db.select({ id: s.carts.id, email: s.carts.email, updatedAt: s.carts.updatedAt, reminders: s.carts.remindersSent, name: s.user.name, userEmail: s.user.email, phone: s.user.phone })
    .from(s.carts).leftJoin(s.user, eq(s.user.id, s.carts.userId))
    .where(and(
      lt(s.carts.updatedAt, sql`now() - interval '1 hour'`), gt(s.carts.updatedAt, sql`now() - interval '30 days'`),
      exists(db.select({ one: sql`1` }).from(s.cartItems).where(eq(s.cartItems.cartId, s.carts.id))),
    )).orderBy(desc(s.carts.updatedAt)).limit(40);
  const rows = await Promise.all(carts.map(async (c) => ({ ...c, lines: await getCartLines(c.id) })));
  const known = rows.filter((r) => r.userEmail || r.email);
  const value = (lines: Awaited<ReturnType<typeof getCartLines>>) => lines.reduce((t, l) => t + l.unitNgn * l.quantity, 0);
  return (
    <>
      <PageTitle title="Abandoned bags" />
      <p className="-mt-3 mb-6 max-w-2xl text-sm text-muted-foreground">
        Shoppers who added items but didn’t pay ({formatMoney(rows.reduce((t, r) => t + value(r.lines), 0), "NGN")} in total). Customers with an email get up to 2 automatic reminders.
        A friendly WhatsApp message often wins them back.
      </p>
      {rows.length ? (
        <Table head={["Shopper", "Bag", "Value", "Last active", "Reminders"]}>
          {rows.map((r) => {
            const email = r.userEmail ?? r.email;
            return (
              <tr key={r.id}>
                <td className={td}>
                  {r.name ?? (email ? "Guest" : "Anonymous visitor")}
                  {email && <span className="block text-xs text-muted-foreground">{email}</span>}
                  {r.phone && <a href={whatsappLink(r.phone, `Hi ${r.name?.split(" ")[0] ?? ""}, it’s Melaré. You left some lovely things in your bag. Can we help you complete your order?`)} target="_blank" rel="noopener noreferrer" className="text-xs underline">WhatsApp</a>}
                </td>
                <td className={td}>{r.lines.map((l) => <span key={l.id} className="block">{l.name} · {l.label} × {l.quantity}</span>)}</td>
                <td className={td}>{formatMoney(value(r.lines), "NGN")}</td>
                <td className={td}>{r.updatedAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" })}</td>
                <td className={td}>{r.reminders}/2</td>
              </tr>
            );
          })}
        </Table>
      ) : <EmptyState>No abandoned bags in the last 30 days.</EmptyState>}
      {rows.length > 0 && <p className="mt-3 text-xs text-muted-foreground">{known.length} of {rows.length} can be contacted.</p>}
    </>
  );
}
