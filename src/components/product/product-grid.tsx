import { getProducts } from "@/lib/catalog";
import { getCurrency } from "@/lib/request";
import { ProductCard } from "./product-card";
import type { Sort } from "@/lib/constants";

type Filters = Parameters<typeof getProducts>[0];

/** Dynamic (currency cookie) wrapper around the cached catalogue. Render inside <Suspense>. */
export async function ProductGrid({ filters, limit, empty, priorityCount = 2 }: { filters?: Filters & { sort?: Sort }; limit?: number; empty?: React.ReactNode; priorityCount?: number }) {
  const [currency, products] = await Promise.all([getCurrency(), getProducts(filters)]);
  const list = limit ? products.slice(0, limit) : products;
  if (!list.length) return <>{empty ?? <p className="py-16 text-center text-muted-foreground">No products found.</p>}</>;
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-5">
      {list.map((p, i) => <ProductCard key={p.id} product={p} currency={currency} priority={i < priorityCount} />)}
    </div>
  );
}

export function GridSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-3 lg:grid-cols-4 lg:gap-x-5" aria-hidden>
      {Array.from({ length: count }, (_, i) => (
        <div key={i}><div className="aspect-[4/5] animate-pulse rounded-2xl bg-sand" /><div className="mt-3 h-3 w-2/3 rounded bg-sand" /><div className="mt-2 h-3 w-1/3 rounded bg-sand" /></div>
      ))}
    </div>
  );
}
