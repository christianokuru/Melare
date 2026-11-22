import "server-only";
import { and, desc, eq, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";

/** Orders owned by this user only (user id OR their verified email from guest checkouts). */
export function ownedBy(userId: string, email: string) {
  return sql`(${s.orders.userId} = ${userId} or (${s.orders.userId} is null and lower(${s.orders.email}) = ${email.toLowerCase()}))`;
}

export async function listOrders(userId: string, email: string, limit = 50) {
  return db.select().from(s.orders).where(ownedBy(userId, email)).orderBy(desc(s.orders.createdAt)).limit(limit);
}

export async function getOwnedOrder(number: string, userId: string, email: string) {
  const [o] = await db.select().from(s.orders).where(and(eq(s.orders.number, number), ownedBy(userId, email)));
  if (!o) return null;
  const items = await db.select().from(s.orderItems).where(eq(s.orderItems.orderId, o.id));
  return { ...o, items };
}
