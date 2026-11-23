import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { and, asc, desc, eq, ilike, inArray, or, sql, arrayContains } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { bundlePrice } from "./money";
import type { Sort } from "./constants";

export const CATALOG_TAG = "catalog";

export type ProductCard = {
  id: string; slug: string; name: string; tagline: string; image: string; imageAlt: string; hoverImage: string | null;
  priceNgn: number; priceUsd: number; compareAtNgn: number | null; compareAtUsd: number | null;
  defaultVariantId: string | null; variantCount: number; inStock: boolean; featured: boolean;
  rating: number; reviewCount: number; createdAt: Date;
};

async function toCards(rows: (typeof s.products.$inferSelect)[]): Promise<ProductCard[]> {
  if (!rows.length) return [];
  const ids = rows.map((p) => p.id);
  const [variants, images, ratings] = await Promise.all([
    db.select().from(s.productVariants).where(inArray(s.productVariants.productId, ids)).orderBy(asc(s.productVariants.position), asc(s.productVariants.priceNgn)),
    db.select().from(s.productImages).where(inArray(s.productImages.productId, ids)).orderBy(asc(s.productImages.position)),
    db.select({ productId: s.reviews.productId, avg: sql<number>`avg(${s.reviews.rating})::float`, count: sql<number>`count(*)::int` })
      .from(s.reviews).where(and(inArray(s.reviews.productId, ids), eq(s.reviews.approved, true))).groupBy(s.reviews.productId),
  ]);
  return rows.map((p) => {
    const vs = variants.filter((v) => v.productId === p.id);
    const imgs = images.filter((i) => i.productId === p.id);
    const first = vs[0];
    const r = ratings.find((x) => x.productId === p.id);
    return {
      id: p.id, slug: p.slug, name: p.name, tagline: p.tagline,
      image: imgs[0]?.src ?? "/icon-512.png", imageAlt: imgs[0]?.alt ?? p.name, hoverImage: imgs[1]?.src ?? null,
      priceNgn: first?.priceNgn ?? 0, priceUsd: first?.priceUsd ?? 0,
      compareAtNgn: first?.compareAtNgn ?? null, compareAtUsd: first?.compareAtUsd ?? null,
      defaultVariantId: first?.id ?? null, variantCount: vs.length, inStock: vs.some((v) => v.stock > 0),
      featured: p.featured, rating: r ? Math.round(r.avg * 10) / 10 : 0, reviewCount: r?.count ?? 0, createdAt: p.createdAt,
    };
  });
}

export async function getCategories() {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);
  return db.select().from(s.categories).orderBy(asc(s.categories.position));
}

export async function getProducts(f: { category?: string; concern?: string; skinType?: string; q?: string; sort?: Sort; featured?: boolean } = {}) {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);
  const where = [eq(s.products.status, "active")];
  if (f.category) {
    const [cat] = await db.select({ id: s.categories.id }).from(s.categories).where(eq(s.categories.slug, f.category));
    if (!cat) return [];
    where.push(eq(s.products.categoryId, cat.id));
  }
  if (f.concern) where.push(arrayContains(s.products.concerns, [f.concern]));
  if (f.skinType) where.push(arrayContains(s.products.skinTypes, [f.skinType]));
  if (f.featured) where.push(eq(s.products.featured, true));
  if (f.q) {
    const q = `%${f.q.replace(/[%_\\]/g, "\\$&")}%`;
    where.push(or(ilike(s.products.name, q), ilike(s.products.tagline, q), ilike(s.products.description, q))!);
  }
  const rows = await db.select().from(s.products).where(and(...where)).orderBy(desc(s.products.featured), asc(s.products.name));
  const cards = await toCards(rows);
  if (f.sort === "price-asc") cards.sort((a, b) => a.priceNgn - b.priceNgn);
  if (f.sort === "price-desc") cards.sort((a, b) => b.priceNgn - a.priceNgn);
  if (f.sort === "newest") cards.sort((a, b) => +b.createdAt - +a.createdAt);
  return cards;
}

export async function getProduct(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);
  const [p] = await db.select().from(s.products).where(and(eq(s.products.slug, slug), eq(s.products.status, "active")));
  if (!p) return null;
  const [variants, images, category, [card]] = await Promise.all([
    db.select().from(s.productVariants).where(eq(s.productVariants.productId, p.id)).orderBy(asc(s.productVariants.position), asc(s.productVariants.priceNgn)),
    db.select().from(s.productImages).where(eq(s.productImages.productId, p.id)).orderBy(asc(s.productImages.position)),
    p.categoryId ? db.select().from(s.categories).where(eq(s.categories.id, p.categoryId)).then((r) => r[0] ?? null) : null,
    toCards([p]),
  ]);
  return { ...p, variants, images, category, rating: card.rating, reviewCount: card.reviewCount };
}

export async function getReviews(productId: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);
  return db.select({ id: s.reviews.id, authorName: s.reviews.authorName, rating: s.reviews.rating, title: s.reviews.title, body: s.reviews.body, skinType: s.reviews.skinType, createdAt: s.reviews.createdAt })
    .from(s.reviews).where(and(eq(s.reviews.productId, productId), eq(s.reviews.approved, true))).orderBy(desc(s.reviews.createdAt)).limit(50);
}

/** Store-wide social proof for the home page: average rating, count and recent 4–5★ reviews (approved, active products). */
export async function getReviewHighlights() {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);
  const visible = and(eq(s.reviews.approved, true), eq(s.products.status, "active"));
  const [[summary], reviews] = await Promise.all([
    db.select({ avg: sql<number>`coalesce(round(avg(${s.reviews.rating})::numeric, 1), 0)::float`, count: sql<number>`count(*)::int` })
      .from(s.reviews).innerJoin(s.products, eq(s.products.id, s.reviews.productId)).where(visible),
    db.select({ id: s.reviews.id, authorName: s.reviews.authorName, rating: s.reviews.rating, title: s.reviews.title, body: s.reviews.body, skinType: s.reviews.skinType, product: s.products.name, slug: s.products.slug })
      .from(s.reviews).innerJoin(s.products, eq(s.products.id, s.reviews.productId)).where(and(visible, sql`${s.reviews.rating} >= 4`))
      .orderBy(desc(s.reviews.createdAt)).limit(10),
  ]);
  return { avg: Number(summary.avg), count: summary.count, reviews };
}

export async function getRelated(productId: string, concerns: string[]) {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);
  const [all, rows] = await Promise.all([
    getProducts(),
    db.select({ id: s.products.id, concerns: s.products.concerns }).from(s.products).where(eq(s.products.status, "active")),
  ]);
  const shared = (id: string) => rows.find((r) => r.id === id)?.concerns.filter((c) => concerns.includes(c)).length ?? 0;
  return all
    .filter((p) => p.id !== productId)
    .sort((a, b) => shared(b.id) - shared(a.id) || Number(b.inStock) - Number(a.inStock))
    .slice(0, 4);
}

export type BundleView = Awaited<ReturnType<typeof getBundles>>[number];

export async function getBundles() {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);
  const bs = await db.select().from(s.bundles).where(eq(s.bundles.active, true)).orderBy(asc(s.bundles.name));
  if (!bs.length) return [];
  const items = await db
    .select({ bundleId: s.bundleItems.bundleId, quantity: s.bundleItems.quantity, variantId: s.productVariants.id, label: s.productVariants.label,
      priceNgn: s.productVariants.priceNgn, priceUsd: s.productVariants.priceUsd, stock: s.productVariants.stock,
      productName: s.products.name, productSlug: s.products.slug, productStatus: s.products.status })
    .from(s.bundleItems)
    .innerJoin(s.productVariants, eq(s.productVariants.id, s.bundleItems.variantId))
    .innerJoin(s.products, eq(s.products.id, s.productVariants.productId))
    .where(inArray(s.bundleItems.bundleId, bs.map((b) => b.id)));
  return bs.map((b) => {
    const its = items.filter((i) => i.bundleId === b.id);
    const sumNgn = its.reduce((t, i) => t + i.priceNgn * i.quantity, 0);
    const sumUsd = its.reduce((t, i) => t + i.priceUsd * i.quantity, 0);
    const available = its.length > 0 && its.every((i) => i.productStatus === "active" && i.stock >= i.quantity);
    return { ...b, items: its, sumNgn, sumUsd, priceNgn: bundlePrice(sumNgn, b.discountPercent), priceUsd: bundlePrice(sumUsd, b.discountPercent), available };
  });
}

export async function getBundle(slug: string) {
  return (await getBundles()).find((b) => b.slug === slug) ?? null;
}

export async function getShippingZones() {
  "use cache";
  cacheLife("hours");
  cacheTag(CATALOG_TAG);
  return db.select().from(s.shippingZones).orderBy(asc(s.shippingZones.position));
}
