import { desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getSession } from "@/lib/auth";
import { ownedBy } from "@/lib/account";

/** "Download my data" (NDPA / GDPR access request): everything we hold about the signed-in customer, as JSON. */
export async function GET() {
  const session = await getSession();
  if (!session) return new Response("Please sign in", { status: 401 });
  const { user } = session;
  const email = user.email.toLowerCase();
  const [profile, addresses, orders, reviews, wishlist, quiz, subscribed, codes] = await Promise.all([
    db.select({ name: s.user.name, email: s.user.email, phone: s.user.phone, referralCode: s.user.referralCode, joined: s.user.createdAt }).from(s.user).where(eq(s.user.id, user.id)),
    db.select().from(s.addresses).where(eq(s.addresses.userId, user.id)),
    db.select().from(s.orders).where(ownedBy(user.id, user.email)).orderBy(desc(s.orders.createdAt)),
    db.select({ product: s.products.name, rating: s.reviews.rating, title: s.reviews.title, body: s.reviews.body, skinType: s.reviews.skinType, createdAt: s.reviews.createdAt })
      .from(s.reviews).innerJoin(s.products, eq(s.products.id, s.reviews.productId)).where(eq(s.reviews.userId, user.id)),
    db.select({ product: s.products.name, savedAt: s.wishlist.createdAt }).from(s.wishlist).innerJoin(s.products, eq(s.products.id, s.wishlist.productId)).where(eq(s.wishlist.userId, user.id)),
    db.select({ answers: s.quizResults.answers, createdAt: s.quizResults.createdAt }).from(s.quizResults).where(sql`${s.quizResults.userId} = ${user.id} or lower(${s.quizResults.email}) = ${email}`),
    db.select().from(s.subscribers).where(sql`lower(${s.subscribers.email}) = ${email}`),
    db.select({ code: s.coupons.code, redemptions: s.coupons.redemptions, expiresAt: s.coupons.expiresAt }).from(s.coupons).where(eq(s.coupons.userId, user.id)),
  ]);
  const items = orders.length ? await db.select().from(s.orderItems).where(inArray(s.orderItems.orderId, orders.map((o) => o.id))) : [];
  const data = {
    exportedAt: new Date().toISOString(),
    profile: profile[0],
    newsletter: subscribed.length > 0,
    addresses: addresses.map(({ userId: _u, ...a }) => a),
    orders: orders.map((o) => ({
      number: o.number, status: o.status, placed: o.createdAt, currency: o.currency, subtotal: o.subtotal / 100, delivery: o.shippingFee / 100,
      discount: o.discount / 100, total: o.total / 100, shippingAddress: o.shippingAddress, trackingNumber: o.trackingNumber,
      items: items.filter((i) => i.orderId === o.id).map((i) => ({ name: i.name, option: i.label, quantity: i.quantity, unitPrice: i.unitPrice / 100 })),
    })),
    reviews, favourites: wishlist, skinQuiz: quiz, rewardCodes: codes,
  };
  return new Response(JSON.stringify(data, null, 2), {
    headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": 'attachment; filename="melare-my-data.json"', "Cache-Control": "no-store" },
  });
}
