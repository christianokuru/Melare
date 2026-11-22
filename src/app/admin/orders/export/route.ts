import { desc } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getSession, isAdmin } from "@/lib/auth";
import { csvResponse } from "@/lib/csv";
import { orderWhere, parseOrderFilters } from "@/lib/admin-orders";
import { STATUS_LABEL } from "@/lib/order-status";

/** CSV of the orders matching the current filters (max 5,000 rows). */
export async function GET(req: Request) {
  if (!isAdmin((await getSession())?.user)) return new Response("Not found", { status: 404 });
  const f = parseOrderFilters(Object.fromEntries(new URL(req.url).searchParams));
  const rows = await db.select().from(s.orders).where(orderWhere(f)).orderBy(desc(s.orders.createdAt)).limit(5000);
  return csvResponse("melare-orders.csv",
    ["order", "placed", "status", "customer", "email", "phone", "city", "state", "country", "currency", "subtotal", "delivery", "discount", "total", "tracking"],
    rows.map((o) => [
      o.number, o.createdAt.toISOString(), STATUS_LABEL[o.status], o.shippingAddress.fullName, o.email, o.shippingAddress.phone,
      o.shippingAddress.city, o.shippingAddress.state, o.shippingAddress.country, o.currency,
      o.subtotal / 100, o.shippingFee / 100, o.discount / 100, o.total / 100, o.trackingNumber ?? "",
    ]));
}
