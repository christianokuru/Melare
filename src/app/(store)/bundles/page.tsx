import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { getBundles } from "@/lib/catalog";
import { getCurrency } from "@/lib/request";
import { Breadcrumbs, container } from "@/components/site/section";
import { Price } from "@/components/product/price";
import { GridSkeleton } from "@/components/product/product-grid";

export const metadata: Metadata = {
  title: "Skincare Routine Bundles · Save up to 15%",
  description: "Complete morning and night skincare routines for melanin-rich skin, curated and bundled so you save. Delivered in Lagos, Nigeria and worldwide.",
  alternates: { canonical: "/bundles" },
};

export default function BundlesPage() {
  return (
    <div className={`${container} pt-6`}>
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Bundles" }]} />
      <header className="mt-6 mb-10 max-w-2xl">
        <h1 className="font-heading text-[40px] leading-none lg:text-6xl">Routine bundles</h1>
        <p className="mt-4 text-muted-foreground">Complete routines, curated to work together, for less than buying separately.</p>
      </header>
      <Suspense fallback={<GridSkeleton count={2} />}><List /></Suspense>
    </div>
  );
}

async function List() {
  const [currency, bundles] = await Promise.all([getCurrency(), getBundles()]);
  return (
    <div className="grid gap-10 md:grid-cols-2">
      {bundles.map((b) => (
        <Link key={b.id} href={`/bundles/${b.slug}`} className="group">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-sand">
            <Image src={b.image} alt={b.name} fill sizes="(min-width:768px) 50vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
            <span className="eyebrow absolute top-3 left-3 rounded-full bg-background/90 px-3 py-1">Save {b.discountPercent}%</span>
          </div>
          <h2 className="mt-4 font-heading text-3xl">{b.name}</h2>
          <p className="mt-1 text-muted-foreground">{b.tagline}</p>
          <Price amount={currency === "NGN" ? b.priceNgn : b.priceUsd} compareAt={currency === "NGN" ? b.sumNgn : b.sumUsd} currency={currency} className="mt-2" />
        </Link>
      ))}
    </div>
  );
}
