import "server-only";
import { cookies } from "next/headers";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getSession } from "./auth";
import { CART_COOKIE, secureCookie } from "./request";
import { bundlePrice } from "./money";
import { MAX_LINE_QTY } from "./constants";

export type CartLine = {
  id: string;
  kind: "variant" | "bundle";
  refId: string;
  quantity: number;
  name: string;
  label: string;
  image: string;
  href: string;
  productId: string | null;
  unitNgn: number;
  unitUsd: number;
  /** Max purchasable now (stock and per-line cap). 0 = unavailable. */
  maxQty: number;
  /** Variants (and per-unit quantities) this line consumes from inventory. */
  stock: { variantId: string; quantity: number }[];
};

/**
 * Resolves the current shopper's cart.
 * - Signed in: their cart; a guest cart from this browser is merged into it.
 * - Guest: the cart in the httpOnly cookie, only if it belongs to no user.
 * `create` (server actions only) creates the cart and sets the cookie.
 */
export async function resolveCartId(create = false): Promise<string | null> {
  const [session, jar] = await Promise.all([getSession(), cookies()]);
  const cookieId = jar.get(CART_COOKIE)?.value;
  const userId = session?.user.id;

  const [fromCookie] = cookieId ? await db.select().from(s.carts).where(eq(s.carts.id, cookieId)) : [];
  const guestCart = fromCookie && !fromCookie.userId ? fromCookie : null;

  if (userId) {
    const [own] = await db.select().from(s.carts).where(eq(s.carts.userId, userId)).orderBy(asc(s.carts.createdAt)).limit(1);
    if (guestCart) {
      if (!own) {
        await db.update(s.carts).set({ userId, email: session.user.email }).where(and(eq(s.carts.id, guestCart.id), isNull(s.carts.userId)));
        return guestCart.id;
      }
      await mergeInto(own.id, guestCart.id);
    }
    if (own) return own.id;
    if (!create) return null;
    const [c] = await db.insert(s.carts).values({ userId, email: session.user.email }).returning({ id: s.carts.id });
    jar.set(CART_COOKIE, c.id, { ...secureCookie, maxAge: 60 * 60 * 24 * 60 });
    return c.id;
  }

  if (guestCart) return guestCart.id;
  if (!create) return null;
  const [c] = await db.insert(s.carts).values({}).returning({ id: s.carts.id });
  jar.set(CART_COOKIE, c.id, { ...secureCookie, maxAge: 60 * 60 * 24 * 60 });
  return c.id;
}

async function mergeInto(targetId: string, sourceId: string) {
  await db.transaction(async (tx) => {
    const [target, source] = await Promise.all([
      tx.select().from(s.cartItems).where(eq(s.cartItems.cartId, targetId)),
      tx.select().from(s.cartItems).where(eq(s.cartItems.cartId, sourceId)),
    ]);
    for (const it of source) {
      const existing = target.find((t) => (it.variantId && t.variantId === it.variantId) || (it.bundleId && t.bundleId === it.bundleId));
      if (existing) {
        await tx.update(s.cartItems).set({ quantity: Math.min(MAX_LINE_QTY, Math.max(existing.quantity, it.quantity)) }).where(eq(s.cartItems.id, existing.id));
      } else {
        // Concurrent renders may merge at the same time: unique indexes + DO NOTHING keep this idempotent.
        await tx.insert(s.cartItems).values({ cartId: targetId, variantId: it.variantId, bundleId: it.bundleId, quantity: it.quantity }).onConflictDoNothing();
      }
    }
    await tx.delete(s.carts).where(eq(s.carts.id, sourceId));
  });
}

/** Cart lines priced from the database (never from the client). */
export async function getCartLines(cartId: string | null): Promise<CartLine[]> {
  if (!cartId) return [];
  const items = await db.select().from(s.cartItems).where(eq(s.cartItems.cartId, cartId)).orderBy(asc(s.cartItems.createdAt));
  if (!items.length) return [];

  const variantIds = items.flatMap((i) => (i.variantId ? [i.variantId] : []));
  const bundleIds = items.flatMap((i) => (i.bundleId ? [i.bundleId] : []));

  const [variants, bundles, components] = await Promise.all([
    variantIds.length
      ? db.select({ v: s.productVariants, p: s.products }).from(s.productVariants)
          .innerJoin(s.products, eq(s.products.id, s.productVariants.productId)).where(inArray(s.productVariants.id, variantIds))
      : [],
    bundleIds.length ? db.select().from(s.bundles).where(inArray(s.bundles.id, bundleIds)) : [],
    bundleIds.length
      ? db.select({ bundleId: s.bundleItems.bundleId, quantity: s.bundleItems.quantity, v: s.productVariants, status: s.products.status })
          .from(s.bundleItems).innerJoin(s.productVariants, eq(s.productVariants.id, s.bundleItems.variantId))
          .innerJoin(s.products, eq(s.products.id, s.productVariants.productId)).where(inArray(s.bundleItems.bundleId, bundleIds))
      : [],
  ]);
  const productIds = variants.map((r) => r.p.id);
  const images = productIds.length
    ? await db.select().from(s.productImages).where(inArray(s.productImages.productId, productIds)).orderBy(asc(s.productImages.position))
    : [];

  return items.flatMap<CartLine>((it) => {
    if (it.variantId) {
      const row = variants.find((r) => r.v.id === it.variantId);
      if (!row) return [];
      const sellable = row.p.status === "active";
      return [{
        id: it.id, kind: "variant", refId: row.v.id, quantity: it.quantity, name: row.p.name, label: row.v.label,
        image: images.find((i) => i.productId === row.p.id)?.src ?? "/icon-512.png", href: `/products/${row.p.slug}`, productId: row.p.id,
        unitNgn: row.v.priceNgn, unitUsd: row.v.priceUsd,
        maxQty: sellable ? Math.min(MAX_LINE_QTY, row.v.stock) : 0,
        stock: [{ variantId: row.v.id, quantity: 1 }],
      }];
    }
    const b = bundles.find((x) => x.id === it.bundleId);
    const comps = components.filter((c) => c.bundleId === it.bundleId);
    if (!b || !comps.length) return [];
    const sumNgn = comps.reduce((t, c) => t + c.v.priceNgn * c.quantity, 0);
    const sumUsd = comps.reduce((t, c) => t + c.v.priceUsd * c.quantity, 0);
    const sellable = b.active && comps.every((c) => c.status === "active");
    const canMake = Math.min(...comps.map((c) => Math.floor(c.v.stock / c.quantity)));
    return [{
      id: it.id, kind: "bundle", refId: b.id, quantity: it.quantity, name: b.name, label: `Bundle · save ${b.discountPercent}%`,
      image: b.image, href: `/bundles/${b.slug}`, productId: null,
      unitNgn: bundlePrice(sumNgn, b.discountPercent), unitUsd: bundlePrice(sumUsd, b.discountPercent),
      maxQty: sellable ? Math.min(MAX_LINE_QTY, canMake) : 0,
      stock: comps.map((c) => ({ variantId: c.v.id, quantity: c.quantity })),
    }];
  });
}

export async function getCart() {
  const cartId = await resolveCartId();
  const lines = await getCartLines(cartId);
  return { cartId, lines, count: lines.reduce((n, l) => n + l.quantity, 0) };
}
