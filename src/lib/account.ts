import "server-only";
import { and, desc, eq, exists, inArray, isNotNull, isNull, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { PAID_STATUSES } from "./order-status";

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

/** Products the customer has bought that should be running out (paid date + days supply × qty), within a week or overdue ≤45 days. */
export async function runningLow(userId: string, email: string) {
  const latest = db.selectDistinctOn([s.products.id], {
    productId: s.products.id, name: s.products.name, slug: s.products.slug, image: s.orderItems.image, label: s.orderItems.label,
    variantId: sql<string>`${s.orderItems.stock}->0->>'variantId'`.as("variant_id"),
    runsOut: sql<Date>`${s.orders.paidAt} + make_interval(days => ${s.products.daysSupply} * ${s.orderItems.quantity})`.as("runs_out"),
  }).from(s.orderItems)
    .innerJoin(s.orders, eq(s.orders.id, s.orderItems.orderId))
    .innerJoin(s.products, eq(s.products.id, s.orderItems.productId))
    .where(and(ownedBy(userId, email), inArray(s.orders.status, [...PAID_STATUSES]), isNotNull(s.products.daysSupply), isNull(s.orderItems.bundleId), eq(s.products.status, "active")))
    .orderBy(s.products.id, desc(s.orders.paidAt)).as("latest");
  return db.select({
    productId: latest.productId, name: latest.name, slug: latest.slug, image: latest.image, label: latest.label, variantId: latest.variantId,
    daysLeft: sql<number>`ceil(extract(epoch from ${latest.runsOut} - now()) / 86400)::int`,
  }).from(latest).where(sql`${latest.runsOut} < now() + interval '7 days' and ${latest.runsOut} > now() - interval '45 days'`).orderBy(latest.runsOut).limit(4);
}

/** Delivered products the customer hasn't reviewed yet. */
export async function reviewPrompts(userId: string, email: string) {
  return db.selectDistinct({ id: s.products.id, name: s.products.name, slug: s.products.slug }).from(s.orderItems)
    .innerJoin(s.orders, eq(s.orders.id, s.orderItems.orderId))
    .innerJoin(s.products, eq(s.products.id, s.orderItems.productId))
    .where(and(ownedBy(userId, email), eq(s.orders.status, "delivered"), eq(s.products.status, "active"),
      sql`not ${exists(db.select({ one: sql`1` }).from(s.reviews).where(and(eq(s.reviews.userId, userId), eq(s.reviews.productId, s.products.id))))}`))
    .limit(4);
}

/** Latest skin-quiz answers (taken while signed in, or with the same email). */
export async function skinProfile(userId: string, email: string) {
  const [q] = await db.select().from(s.quizResults)
    .where(sql`${s.quizResults.userId} = ${userId} or lower(${s.quizResults.email}) = ${email.toLowerCase()}`)
    .orderBy(desc(s.quizResults.createdAt)).limit(1);
  return q ? { ...q, answers: q.answers as { skinType: string; concerns: string[]; sensitivity?: string } } : null;
}
