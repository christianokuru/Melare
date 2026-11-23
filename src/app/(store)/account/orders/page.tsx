import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { listOrders } from "@/lib/account";
import { formatMoney, type Currency } from "@/lib/money";
import { StatusBadge } from "@/components/order/order-view";

// Fresh session check on every request, so this route blocks rather than prefetching.
export const instant = false;

export default async function OrdersPage() {
  const { user } = await requireUser("/account/orders");
  const orders = await listOrders(user.id, user.email);
  if (!orders.length) return <p className="text-muted-foreground">You haven’t placed any orders yet. <Link href="/shop" className="underline">Shop now</Link>.</p>;
  return (
    <ul className="divide-y border-y">
      {orders.map((o) => (
        <li key={o.id}>
          <Link href={`/account/orders/${o.number}`} className="flex flex-wrap items-center justify-between gap-3 py-4 text-sm hover:bg-blush/40">
            <span><span className="block font-medium">{o.number}</span><span className="text-muted-foreground">{o.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}{!o.userId && " · guest checkout"}</span></span>
            <span className="flex items-center gap-3"><StatusBadge status={o.status} /><span className="w-24 text-right">{formatMoney(o.total, o.currency as Currency)}</span></span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
