import "server-only";
import { and, eq, ilike, or, sql, type SQL } from "drizzle-orm";
import { schema as s } from "@/db";
import { STATUS_LABEL } from "./order-status";

type Params = Record<string, string | string[] | undefined>;
export type OrderFilters = { status?: string; q: string; from: string; to: string };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const str = (sp: Params, k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");

/** Validated filters from the orders page / CSV export query string. */
export function parseOrderFilters(sp: Params): OrderFilters {
  const status = str(sp, "status");
  return {
    status: status in STATUS_LABEL ? status : undefined,
    q: str(sp, "q").slice(0, 80),
    from: DATE.test(str(sp, "from")) ? str(sp, "from") : "",
    to: DATE.test(str(sp, "to")) ? str(sp, "to") : "",
  };
}

/** Search (number, email, name, phone) + Lagos-date range, optionally + status. */
export function orderWhere(f: OrderFilters, withStatus = true) {
  const where: SQL[] = [];
  if (withStatus && f.status) where.push(eq(s.orders.status, f.status as (typeof s.orderStatus.enumValues)[number]));
  if (f.q) {
    const like = `%${f.q.replace(/[%_\\]/g, "\\$&")}%`;
    const digits = f.q.replace(/\D/g, "").replace(/^0+/, ""); // "0803…" (local) matches "+234803…" (international)
    where.push(or(ilike(s.orders.number, like), ilike(s.orders.email, like), sql`${s.orders.shippingAddress}->>'fullName' ilike ${like}`,
      ...(digits.length >= 4 ? [sql`regexp_replace(${s.orders.shippingAddress}->>'phone', '\\D', '', 'g') like ${`%${digits}%`}`] : []))!);
  }
  const day = sql`(${s.orders.createdAt} at time zone 'Africa/Lagos')::date`;
  if (f.from) where.push(sql`${day} >= ${f.from}::date`);
  if (f.to) where.push(sql`${day} <= ${f.to}::date`);
  return where.length ? and(...where) : undefined;
}

export function ordersQuery(f: OrderFilters, extra: Record<string, string | number | undefined> = {}) {
  const params = Object.entries({ status: f.status, q: f.q, from: f.from, to: f.to, ...extra }).filter(([, v]) => v != null && v !== "");
  return new URLSearchParams(params.map(([k, v]) => [k, String(v)])).toString();
}
