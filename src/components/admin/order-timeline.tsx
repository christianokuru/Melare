import { STATUS_LABEL } from "@/lib/order-status";

type Event = { status: string; message: string | null; createdAt: Date };
type OrderDates = { createdAt: Date; paidAt: Date | null; shippedAt: Date | null; deliveredAt: Date | null };

/** Newest-first order history. Orders placed before the timeline existed fall back to their timestamps. */
export function OrderTimeline({ events, order }: { events: Event[]; order: OrderDates }) {
  const list: Event[] = events.length ? [...events].reverse() : ([
    order.deliveredAt && { status: "delivered", message: null, createdAt: order.deliveredAt },
    order.shippedAt && { status: "shipped", message: null, createdAt: order.shippedAt },
    order.paidAt && { status: "paid", message: null, createdAt: order.paidAt },
    { status: "pending", message: "Order placed", createdAt: order.createdAt },
  ].filter(Boolean) as Event[]);
  return (
    <ol className="grid gap-4 border-l pl-5">
      {list.map((e, i) => (
        <li key={i} className="relative text-sm">
          <span className={`absolute top-1.5 -left-[25px] size-2.5 rounded-full ${i === 0 ? "bg-foreground" : "bg-[#c98b74]"}`} aria-hidden />
          <p className="font-medium">{STATUS_LABEL[e.status] ?? e.status}</p>
          {e.message && <p className="text-muted-foreground">{e.message}</p>}
          <time className="text-xs text-muted-foreground" dateTime={e.createdAt.toISOString()}>{e.createdAt.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Africa/Lagos" })}</time>
        </li>
      ))}
    </ol>
  );
}
