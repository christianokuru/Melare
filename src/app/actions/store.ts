"use server";
import { z } from "zod";
import { cookies } from "next/headers";
import { refresh } from "next/cache";
import { and, eq, notInArray, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getSession } from "@/lib/auth";
import { throttle } from "@/lib/throttle";
import { CURRENCY_COOKIE } from "@/lib/request";
import { isCurrency } from "@/lib/money";
import { CONCERNS, SKIN_TYPES } from "@/lib/constants";
import { sendEmail, escapeHtml, suppress } from "@/lib/email";
import { confirmSubscribeUrl, verifyEmailToken } from "@/lib/email-tokens";
import { canonicalEmail } from "@/lib/checkout";

type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const Email = z.string().trim().toLowerCase().email().max(254);
const LIMITED = { ok: false as const, error: "Too many attempts. Please try again later." };

export async function setCurrency(currency: string) {
  if (!isCurrency(currency)) return;
  (await cookies()).set(CURRENCY_COOKIE, currency, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  refresh();
}

/** Newsletter sign-up = double opt-in: we only email a fixed "confirm" message, at most once a week per address. */
export async function subscribe(email: string): Promise<Result> {
  const e = Email.safeParse(email);
  if (!e.success) return { ok: false, error: "Enter a valid email address." };
  try {
    return await startSubscription(e.data);
  } catch (err) {
    console.error("[subscribe]", err instanceof Error ? (err.cause ?? err.message) : err);
    return { ok: false, error: "We couldn’t sign you up right now. Please try again in a moment." };
  }
}

async function startSubscription(email: string): Promise<Result> {
  if (!(await throttle("subscribe", 5, 3600))) return LIMITED;
  const [already] = await db.select({ email: s.subscribers.email }).from(s.subscribers).where(eq(s.subscribers.email, email));
  if (!already && (await throttle("subscribe-to", 1, 7 * 86400, canonicalEmail(email)))) {
    await sendEmail(email, "Confirm your subscription · Melaré", "One tap to join",
      "<p>Someone (hopefully you) asked to join the Melaré newsletter with this email. Confirm below to get launches, restocks and your 10% welcome code.</p><p style=\"color:#6B5045\">Didn’t ask for this? Ignore this email and you won’t hear from us.</p>",
      { label: "Confirm subscription", url: confirmSubscribeUrl(email) });
  }
  return { ok: true }; // same answer either way: no email enumeration
}

export async function unsubscribe(email: string, token: string): Promise<Result> {
  const e = Email.safeParse(email);
  if (!e.success || !verifyEmailToken("unsubscribe", e.data, String(token))) return { ok: false, error: "This unsubscribe link has expired." };
  await suppress(e.data, "link");
  return { ok: true };
}

export async function notifyWhenInStock(email: string, variantId: string): Promise<Result> {
  const e = Email.safeParse(email);
  const v = z.string().uuid().safeParse(variantId);
  if (!e.success || !v.success) return { ok: false, error: "Enter a valid email address." };
  if (!(await throttle("stock-alert", 10, 3600))) return LIMITED;
  const [variant] = await db.select({ id: s.productVariants.id }).from(s.productVariants).where(eq(s.productVariants.id, v.data));
  if (!variant) return { ok: false, error: "Product not found." };
  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(s.stockAlerts).where(eq(s.stockAlerts.email, e.data));
  if (n >= 20) return { ok: false, error: "You’re already waiting on lots of products. We’ll email you when they’re back." };
  await db.insert(s.stockAlerts).values({ email: e.data, variantId: v.data }).onConflictDoNothing();
  return { ok: true };
}

export async function toggleWishlist(productId: string): Promise<Result<{ saved: boolean }>> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sign in to save favourites." };
  if (!z.string().uuid().safeParse(productId).success) return { ok: false, error: "Invalid product." };
  const where = and(eq(s.wishlist.userId, session.user.id), eq(s.wishlist.productId, productId));
  const deleted = await db.delete(s.wishlist).where(where).returning();
  if (!deleted.length) {
    const [p] = await db.select({ id: s.products.id }).from(s.products).where(and(eq(s.products.id, productId), eq(s.products.status, "active")));
    if (!p) return { ok: false, error: "Product not found." };
    await db.insert(s.wishlist).values({ userId: session.user.id, productId }).onConflictDoNothing();
  }
  refresh();
  return { ok: true, saved: !deleted.length };
}

const ReviewInput = z.object({
  productId: z.string().uuid(),
  rating: z.coerce.number().int().min(1).max(5),
  title: z.string().trim().min(2).max(80),
  body: z.string().trim().min(10).max(1500),
  skinType: z.enum(SKIN_TYPES),
});

/** Verified buyers only: the product must be in one of their paid orders. Reviews are moderated. */
export async function submitReview(input: z.input<typeof ReviewInput>): Promise<Result> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Sign in to leave a review." };
  const parsed = ReviewInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please complete every field (review at least 10 characters)." };
  if (!(await throttle("review", 5, 3600, session.user.id))) return LIMITED;
  const d = parsed.data;
  const [bought] = await db.select({ id: s.orderItems.id }).from(s.orderItems)
    .innerJoin(s.orders, eq(s.orders.id, s.orderItems.orderId))
    .where(and(eq(s.orders.userId, session.user.id), eq(s.orderItems.productId, d.productId), notInArray(s.orders.status, ["pending", "cancelled", "refunded"])))
    .limit(1);
  if (!bought) return { ok: false, error: "Only customers who bought this product can review it." };
  const inserted = await db.insert(s.reviews).values({
    productId: d.productId, userId: session.user.id, authorName: session.user.name.split(" ")[0].slice(0, 40),
    rating: d.rating, title: d.title, body: d.body, skinType: d.skinType,
  }).onConflictDoNothing().returning();
  if (!inserted.length) return { ok: false, error: "You’ve already reviewed this product." };
  return { ok: true };
}

const QuizInput = z.object({
  skinType: z.enum(SKIN_TYPES),
  concerns: z.array(z.enum(CONCERNS.map((c) => c.slug) as [string, ...string[]])).min(1).max(3),
  sensitivity: z.enum(["low", "medium", "high"]),
  routine: z.enum(["minimal", "balanced", "full"]),
  spf: z.enum(["daily", "sometimes", "never"]),
  email: z.union([Email, z.literal("")]).optional(),
});

/** Scores active products against answers; stores the result (and email, if given). */
export async function submitQuiz(input: z.input<typeof QuizInput>): Promise<Result<{ slugs: string[] }>> {
  const parsed = QuizInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please answer every question." };
  if (!(await throttle("quiz", 20, 3600))) return LIMITED;
  const a = parsed.data;
  const products = await db.select({ id: s.products.id, slug: s.products.slug, concerns: s.products.concerns, skinTypes: s.products.skinTypes, category: s.categories.slug })
    .from(s.products).leftJoin(s.categories, eq(s.categories.id, s.products.categoryId)).where(eq(s.products.status, "active"));
  const score = (p: (typeof products)[number]) =>
    p.concerns.filter((c) => a.concerns.includes(c)).length * 3 + (p.skinTypes.includes(a.skinType) ? 2 : 0)
    + (p.category === "cleansers" || p.category === "sun-care" ? 2 : 0) + (a.spf !== "daily" && p.category === "sun-care" ? 2 : 0);
  const size = a.routine === "minimal" ? 3 : a.routine === "balanced" ? 4 : 5;
  const picked = products.map((p) => ({ p, sc: score(p) })).filter((x) => x.sc > 0).sort((x, y) => y.sc - x.sc).slice(0, size).map((x) => x.p);
  const session = await getSession(); // signed-in shoppers keep this as their skin profile
  await db.insert(s.quizResults).values({ userId: session?.user.id ?? null, email: a.email || null, answers: a, productIds: picked.map((p) => p.id) });
  // Fixed-content email, max once a day per address, unsubscribe-able; joining the newsletter still needs a confirm tap.
  if (a.email && (await throttle("quiz-to", 1, 86400, canonicalEmail(a.email)))) {
    await sendEmail(a.email, "Your Melaré routine", "Your routine, made for your skin",
      `<p>Based on your answers (${escapeHtml(a.skinType)} skin), we recommend:</p><ul>${picked.map((p) => `<li>${escapeHtml(p.slug.replace(/-/g, " "))}</li>`).join("")}</ul><p>Want launches and 10% off your first order? <a href="${confirmSubscribeUrl(a.email)}">Join the newsletter</a>.</p>`,
      { label: "Shop my routine", url: `${process.env.NEXT_PUBLIC_APP_URL}/quiz/results?p=${picked.map((p) => p.slug).join(",")}` }, { marketing: true });
  }
  return { ok: true, slugs: picked.map((p) => p.slug) };
}

