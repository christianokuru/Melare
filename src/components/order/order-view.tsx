import Image from "next/image";
import { formatMoney, type Currency } from "@/lib/money";
import { cn } from "@/lib/utils";

export const STATUS_LABEL: Record<string, string> = {
  pending: "Awaiting payment", paid: "Paid", processing: "Preparing", shipped: "Shipped", delivered: "Delivered", cancelled: "Cancelled", refunded: "Refunded",
};
const STEPS = ["paid", "processing", "shipped", "delivered"];

export function StatusBadge({ status }: { status: string }) {
  const tone = status === "cancelled" || status === "refunded" ? "bg-muted text-muted-foreground" : status === "pending" ? "bg-[#f6ead2]" : status === "delivered" ? "bg-[#e3eedf]" : "bg-blush";
  return <span className={cn("inline-block rounded-full px-3 py-1 text-xs", tone)}>{STATUS_LABEL[status] ?? status}</span>;
}

export type OrderViewData = {
  number: string; status: string; currency: Currency; subtotal: number; shippingFee: number; discount: number; total: number;
  createdAt: string | Date; trackingNumber: string | null; shippingZone: string;
  items: { name: string; label: string; quantity: number; unitPrice: number; image: string | null }[];
  address?: { fullName: string; phone: string; line1: string; line2?: string | null; city: string; state: string; country: string; postalCode?: string | null };
};

export function OrderView({ o }: { o: OrderViewData }) {
  const step = STEPS.indexOf(o.status);
  return (
    <div className="grid gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="eyebrow text-muted-foreground">Order {o.number}</p>
          <p className="text-sm text-muted-foreground">Placed {new Date(o.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</p>
        </div>
        <StatusBadge status={o.status} />
      </div>
      {step >= 0 && (
        <ol className="grid grid-cols-4 gap-2 text-center text-[11px] uppercase tracking-[0.08em]" aria-label="Order progress">
          {STEPS.map((st, i) => (
            <li key={st} className={i <= step ? "" : "text-muted-foreground"}>
              <span className={cn("mb-2 block h-1 rounded-full", i <= step ? "bg-foreground" : "bg-muted")} />{STATUS_LABEL[st]}
            </li>
          ))}
        </ol>
      )}
      {o.trackingNumber && <p className="rounded-xl bg-blush p-4 text-sm">Tracking number: <strong className="select-all">{o.trackingNumber}</strong></p>}
      <ul className="divide-y border-y">
        {o.items.map((i, k) => (
          <li key={k} className="flex items-center gap-4 py-4">
            {i.image && <div className="relative aspect-square w-16 shrink-0 overflow-hidden rounded-lg bg-sand"><Image src={i.image} alt="" fill sizes="64px" className="object-cover" /></div>}
            <div className="min-w-0 flex-1 text-sm"><p>{i.name}</p><p className="text-muted-foreground">{i.label} × {i.quantity}</p></div>
            <p className="text-sm">{formatMoney(i.unitPrice * i.quantity, o.currency)}</p>
          </li>
        ))}
      </ul>
      <div className="grid gap-8 sm:grid-cols-2">
        {o.address && (
          <div className="text-sm">
            <p className="eyebrow mb-2 text-muted-foreground">Delivering to</p>
            <p>{o.address.fullName}</p>
            <p>{o.address.line1}{o.address.line2 ? `, ${o.address.line2}` : ""}</p>
            <p>{o.address.city}, {o.address.state}{o.address.postalCode ? ` ${o.address.postalCode}` : ""}, {o.address.country}</p>
            <p className="text-muted-foreground">{o.address.phone}</p>
            <p className="mt-2 text-muted-foreground">{o.shippingZone}</p>
          </div>
        )}
        <dl className="grid h-fit gap-1.5 text-sm">
          <div className="flex justify-between"><dt>Subtotal</dt><dd>{formatMoney(o.subtotal, o.currency)}</dd></div>
          {o.discount > 0 && <div className="flex justify-between"><dt>Discount</dt><dd>−{formatMoney(o.discount, o.currency)}</dd></div>}
          <div className="flex justify-between"><dt>Delivery</dt><dd>{o.shippingFee ? formatMoney(o.shippingFee, o.currency) : "Free"}</dd></div>
          <div className="mt-1 flex justify-between border-t pt-2 text-base"><dt>Total</dt><dd>{formatMoney(o.total, o.currency)}</dd></div>
        </dl>
      </div>
    </div>
  );
}
