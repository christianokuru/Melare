import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { Mail, MessageCircle, Phone, Printer } from "lucide-react";
import { db, schema as s } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { formatMoney, type Currency } from "@/lib/money";
import { whatsappLink } from "@/lib/constants";
import { OrderView, progressDates } from "@/components/order/order-view";
import { OrderTimeline } from "@/components/admin/order-timeline";
import { Table, td, adminGhost } from "@/components/admin/ui";
import { OrderStatusForm } from "./status-form";

// Fresh admin check on every request, so this route blocks rather than prefetching.
export const instant = false;

export default async function AdminOrder({ params }: PageProps<"/admin/orders/[id]">) {
  await requireAdmin();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [o] = await db.select().from(s.orders).where(eq(s.orders.id, id));
  if (!o) notFound();
  const [items, payments, events, coupon] = await Promise.all([
    db.select().from(s.orderItems).where(eq(s.orderItems.orderId, id)),
    db.select().from(s.payments).where(eq(s.payments.orderId, id)).orderBy(desc(s.payments.createdAt)),
    db.select().from(s.orderEvents).where(eq(s.orderEvents.orderId, id)).orderBy(asc(s.orderEvents.createdAt)),
    o.couponId ? db.select().from(s.coupons).where(eq(s.coupons.id, o.couponId)).then((r) => r[0]) : null,
  ]);
  const c = o.currency as Currency;
  const a = o.shippingAddress;
  const contact = "flex items-center gap-2 rounded-full border px-3 py-2 text-xs hover:bg-blush";
  return (
    <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
      <div className="min-w-0">
        <div className="mb-4 flex items-center justify-between gap-3">
          <Link href="/admin/orders" className="eyebrow underline underline-offset-4">← Orders</Link>
          <Link href={`/admin/orders/${o.id}/slip`} className={`${adminGhost} gap-2`}><Printer className="size-4" aria-hidden />Packing slip</Link>
        </div>
        {o.note && <p className="mb-6 rounded-xl bg-[#fbf3e3] p-4 text-sm">⚠ {o.note}</p>}
        <OrderView o={{ ...o, currency: c, items, address: a, progress: progressDates(o, events) }} />
        <h2 className="mt-10 mb-3 font-heading text-2xl">Payments</h2>
        <Table head={["Reference", "Flutterwave ID", "Status", "Amount", "Created"]}>
          {payments.map((p) => <tr key={p.id}><td className={td}>{p.reference}</td><td className={td}>{p.transactionId ?? "-"}</td><td className={td}>{p.status}</td><td className={td}>{formatMoney(p.amount, p.currency as Currency)}</td><td className={td}>{p.createdAt.toLocaleString("en-GB")}</td></tr>)}
        </Table>
      </div>
      <div className="grid h-fit gap-6 xl:sticky xl:top-6">
        <OrderStatusForm id={o.id} status={o.status} trackingNumber={o.trackingNumber ?? ""} note={o.note ?? ""} />
        <section className="rounded-2xl border bg-white p-5 text-sm">
          <h2 className="mb-3 font-heading text-2xl">Customer</h2>
          <p>{a.fullName}</p>
          <p className="text-muted-foreground">{o.email} · {o.userId ? <Link href={`/admin/customers/${o.userId}`} className="underline">account</Link> : "guest"}</p>
          {coupon && <p className="mt-2"><span className="text-muted-foreground">Code:</span> {coupon.code}{coupon.ownerName ? ` · ${coupon.ownerName}` : ""}</p>}
          {o.referrerId && <p className="mt-1 text-muted-foreground">Referral order</p>}
          <div className="mt-4 flex flex-wrap gap-2">
            <a href={`tel:${a.phone.replace(/[^\d+]/g, "")}`} className={contact}><Phone className="size-3.5" aria-hidden />Call</a>
            <a href={whatsappLink(a.phone, `Hi ${a.fullName.split(" ")[0]}, it’s Melaré about your order ${o.number}.`)} target="_blank" rel="noopener noreferrer" className={contact}><MessageCircle className="size-3.5" aria-hidden />WhatsApp</a>
            <a href={`mailto:${o.email}?subject=${encodeURIComponent(`Your Melaré order ${o.number}`)}`} className={contact}><Mail className="size-3.5" aria-hidden />Email</a>
          </div>
        </section>
        <section className="rounded-2xl border bg-white p-5">
          <h2 className="mb-4 font-heading text-2xl">History</h2>
          <OrderTimeline events={events} order={o} />
        </section>
      </div>
    </div>
  );
}
