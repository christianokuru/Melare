import Link from "next/link";
import { eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { getProducts } from "@/lib/catalog";
import { getCurrency } from "@/lib/request";
import { ProductCard } from "@/components/product/product-card";

// Fresh session check on every request, so this route blocks rather than prefetching.
export const instant = false;

export default async function WishlistPage() {
  const { user } = await requireUser("/account/wishlist");
  const [saved, all, currency] = await Promise.all([
    db.select({ productId: s.wishlist.productId }).from(s.wishlist).where(eq(s.wishlist.userId, user.id)),
    getProducts(), getCurrency(),
  ]);
  const ids = new Set(saved.map((w) => w.productId));
  const products = all.filter((p) => ids.has(p.id));
  if (!products.length) return <p className="text-muted-foreground">Tap the heart on any product to save it here. <Link href="/shop" className="underline">Browse products</Link>.</p>;
  return <div className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-3 lg:grid-cols-4">{products.map((p) => <ProductCard key={p.id} product={p} currency={currency} />)}</div>;
}
