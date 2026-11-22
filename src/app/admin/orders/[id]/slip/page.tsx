import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { COUNTRIES } from "@/lib/constants";
import { PrintButton } from "./print-button";

export const instant = false;

/** Printable packing slip: no prices, just what goes in the parcel and where it goes. */
export default async function PackingSlip({ params }: PageProps<"/admin/orders/[id]/slip">) {
  await requireAdmin();
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [o] = await db.select().from(s.orders).where(eq(s.orders.id, id));
  if (!o) notFound();
  const items = await db.select().from(s.orderItems).where(eq(s.orderItems.orderId, id));
  const a = o.shippingAddress;
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex justify-between print:hidden">
        <Link href={`/admin/orders/${o.id}`} className="eyebrow underline underline-offset-4">← Back to order</Link>
        <PrintButton />
      </div>
      <article className="rounded-2xl border bg-white p-8 print:rounded-none print:border-0 print:p-0">
        <header className="flex items-start justify-between border-b pb-6">
          <Image src="/logo.svg" alt="Melaré" width={120} height={52} className="h-10 w-auto" />
          <div className="text-right text-sm"><p className="font-medium">Order {o.number}</p><p className="text-muted-foreground">{o.createdAt.toLocaleDateString("en-GB", { dateStyle: "long" })}</p></div>
        </header>
        <section className="grid gap-6 border-b py-6 text-sm sm:grid-cols-2">
          <div>
            <p className="eyebrow mb-2 text-muted-foreground">Ship to</p>
            <p className="text-base font-medium">{a.fullName}</p>
            <p>{a.line1}</p>{a.line2 && <p>{a.line2}</p>}
            <p>{a.city}, {a.state}{a.postalCode ? ` ${a.postalCode}` : ""}</p>
            <p>{COUNTRIES[a.country] ?? a.country}</p>
            <p className="mt-1">{a.phone}</p>
          </div>
          <div>
            <p className="eyebrow mb-2 text-muted-foreground">Delivery</p>
            <p>{o.shippingZone}</p>
            {o.trackingNumber && <p className="mt-1">Tracking: {o.trackingNumber}</p>}
          </div>
        </section>
        <table className="mt-6 w-full text-sm">
          <thead><tr className="border-b text-left text-xs uppercase tracking-[0.08em] text-muted-foreground"><th className="py-2 font-normal">Packed</th><th className="py-2 font-normal">Item</th><th className="py-2 text-right font-normal">Qty</th></tr></thead>
          <tbody className="divide-y">
            {items.map((i) => (
              <tr key={i.id}><td className="w-14 py-3"><span className="inline-block size-4 rounded border border-foreground/50" aria-hidden /></td><td className="py-3">{i.name}<span className="block text-muted-foreground">{i.label}</span></td><td className="py-3 text-right text-base">{i.quantity}</td></tr>
            ))}
          </tbody>
        </table>
        <p className="mt-10 text-center text-sm text-muted-foreground">Thank you for choosing Melaré. Questions? Reply to your order email or chat with us on WhatsApp.</p>
      </article>
    </div>
  );
}
