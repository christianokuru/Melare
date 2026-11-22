import Image from "next/image";
import { formatMoney, type Currency } from "@/lib/money";
import { cn } from "@/lib/utils";
import { PAID_STATUSES, STATUS_LABEL } from "@/lib/order-status";

const STEPS: readonly string[] = PAID_STATUSES;
const STEP_LABEL: Record<string, string> = { paid: "Confirmed", processing: "Preparing", shipped: "Shipped", delivered: "Delivered" };
type When = Date | string | null | undefined;
export type ProgressDates = Partial<Record<"paid" | "processing" | "shipped" | "delivered", When>>;

/** Dates for the tracker: order timestamps + the "preparing" event from the timeline. */
export const progressDates = (o: { paidAt: When; shippedAt: When; deliveredAt: When }, events: { status: string; createdAt: Date }[]): ProgressDates =>
  ({ paid: o.paidAt, processing: events.find((e) => e.status === "processing")?.createdAt, shipped: o.shippedAt, delivered: o.deliveredAt });

const fmtDay = (d: When) => (d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" }) : "");

export function StatusBadge({ status }: { status: string }) {
  const tone = status === "cancelled" || status === "refunded" ? "bg-muted text-muted-foreground" : status === "pending" ? "bg-[#f6ead2]" : status === "delivered" ? "bg-[#e3eedf]" : "bg-blush";
  return <span className={cn("inline-block rounded-full px-3 py-1 text-xs", tone)}>{STATUS_LABEL[status] ?? status}</span>;
}

export type OrderViewData = {
  number: string; status: string; currency: Currency; subtotal: number; shippingFee: number; discount: number; total: number;
  createdAt: string | Date; trackingNumber: string | null; shippingZone: string; progress?: ProgressDates;
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
          <p className="text-sm text-muted-foreground">Placed {new Date(o.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "Africa/Lagos" })}</p>
        </div>
        <StatusBadge status={o.status} />
      </div>
      {step >= 0 && <OrderTracker status={o.status} progress={o.progress} />}
      {o.status === "pending" && <p className="rounded-xl bg-[#f6ead2] p-4 text-sm">We’re waiting for your payment to be confirmed. This usually takes a few seconds.</p>}
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

/** Paid → Preparing → Shipped → Delivered, with the date each step happened. */
export function OrderTracker({ status, progress }: { status: string; progress?: ProgressDates }) {
  const step = STEPS.indexOf(status);
  return (
    <ol className="grid grid-cols-4" aria-label="Order progress">
      {STEPS.map((st, i) => {
        const done = i <= step;
        const date = progress?.[st as keyof ProgressDates];
        return (
          <li key={st} className="relative flex flex-col items-center text-center" aria-current={i === step ? "step" : undefined}>
            {i > 0 && <span className={cn("absolute top-3 right-1/2 h-0.5 w-full", done ? "bg-foreground" : "bg-muted")} aria-hidden />}
            <span className={cn("relative flex size-6 items-center justify-center rounded-full border text-[11px]", done ? "border-foreground bg-foreground text-background" : "border-muted bg-background text-muted-foreground")} aria-hidden>{done ? "✓" : i + 1}</span>
            <span className={cn("mt-2 text-[11px] uppercase tracking-[0.08em]", !done && "text-muted-foreground")}>{STEP_LABEL[st]}<span className="sr-only">{done ? " (done)" : ""}</span></span>
            {done && date && <span className="text-[11px] text-muted-foreground">{fmtDay(date)}</span>}
          </li>
        );
      })}
    </ol>
  );
}
