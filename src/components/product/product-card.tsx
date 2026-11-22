import Image from "next/image";
import Link from "next/link";
import type { ProductCard as Card } from "@/lib/catalog";
import { priceIn, type Currency } from "@/lib/money";
import { Price } from "./price";
import { Stars } from "./stars";
import { QuickAdd } from "./quick-add";

export function ProductCard({ product: p, currency, priority }: { product: Card; currency: Currency; priority?: boolean }) {
  const compareAt = currency === "NGN" ? p.compareAtNgn : p.compareAtUsd;
  const price = priceIn(p, currency);
  const badge = !p.inStock ? "Sold out" : compareAt && compareAt > price ? "Sale" : p.featured ? "Bestseller" : null;
  return (
    <article className="group flex flex-col">
      <Link href={`/products/${p.slug}`} className="relative block aspect-[4/5] overflow-hidden rounded-2xl bg-sand" aria-label={p.name}>
        <Image src={p.image} alt={p.imageAlt} fill sizes="(min-width:1024px) 25vw, 50vw" priority={priority}
          className="object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]" />
        {p.hoverImage && (
          <Image src={p.hoverImage} alt="" fill sizes="(min-width:1024px) 25vw, 50vw"
            className="object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100 max-md:hidden" />
        )}
        {badge && <span className="eyebrow absolute top-3 left-3 rounded-full bg-background/90 px-2.5 py-1 text-[10px]">{badge}</span>}
      </Link>
      <div className="mt-3 flex flex-col gap-1 px-0.5">
        <h3 className="text-[13px] font-normal uppercase tracking-[0.08em]">
          <Link href={`/products/${p.slug}`} className="hover:underline underline-offset-4">{p.name}</Link>
        </h3>
        <p className="line-clamp-1 text-[13px] text-muted-foreground">{p.tagline}</p>
        {p.reviewCount > 0 && (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Stars rating={p.rating} size={12} /> ({p.reviewCount})</p>
        )}
        <Price amount={price} compareAt={compareAt} currency={currency} className="text-sm" />
      </div>
      {p.defaultVariantId && (
        <QuickAdd variantId={p.defaultVariantId} inStock={p.inStock} multiple={p.variantCount > 1} slug={p.slug}
          tracking={{ id: p.id, name: p.name, price: price / 100, currency }} />
      )}
    </article>
  );
}
