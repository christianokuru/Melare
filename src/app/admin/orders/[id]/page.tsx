import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { formatMoney, type Currency } from "@/lib/money";
import { OrderView } from "@/components/order/order-view";
import { Table, td } from "@/components/admin/ui";
import { OrderStatusForm } from "./status-form";

export default async function AdminOrder({ params }: PageProps<"/admin/orders/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [o] = await db.select().from(s.orders).where(eq(s.orders.id, id));
  if (!o) notFound();
  const [items, payments, coupon] = await Promise.all([
    db.select().from(s.orderItems).where(eq(s.orderItems.orderId, id)),
    db.select().from(s.payments).where(eq(s.payments.orderId, id)).orderBy(desc(s.payments.createdAt)),
    o.couponId ? db.select().from(s.coupons).where(eq(s.coupons.id, o.couponId)).then((r) => r[0]) : null,
  ]);
  const c = o.currency as Currency;
  return (
    <div className="grid gap-8 xl:grid-cols-[1fr_360px]">
      <div>
        <Link href="/admin/orders" className="eyebrow mb-4 inline-block underline underline-offset-4">← Orders</Link>
        {o.note && <p className="mb-6 rounded-xl bg-[#fbf3e3] p-4 text-sm">⚠ {o.note}</p>}
        <OrderView o={{ ...o, currency: c, items, address: o.shippingAddress }} />
        <div className="mt-6 grid gap-1 text-sm">
          <p><span className="text-muted-foreground">Email:</span> {o.email} {o.userId ? "(account)" : "(guest)"}</p>
          {coupon && <p><span className="text-muted-foreground">Code:</span> {coupon.code}{coupon.ownerName ? ` · ${coupon.ownerName}` : ""}</p>}
          {o.referrerId && <p><span className="text-muted-foreground">Referral order</span></p>}
        </div>
        <h2 className="mt-8 mb-3 font-heading text-2xl">Payments</h2>
        <Table head={["Reference", "Flutterwave ID", "Status", "Amount", "Created"]}>
          {payments.map((p) => <tr key={p.id}><td className={td}>{p.reference}</td><td className={td}>{p.transactionId ?? "-"}</td><td className={td}>{p.status}</td><td className={td}>{formatMoney(p.amount, p.currency as Currency)}</td><td className={td}>{p.createdAt.toLocaleString("en-GB")}</td></tr>)}
        </Table>
      </div>
      <OrderStatusForm id={o.id} status={o.status} trackingNumber={o.trackingNumber ?? ""} note={o.note ?? ""} />
    </div>
  );
}
