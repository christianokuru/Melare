import Link from "next/link";
import { Suspense } from "react";
import { getCategories } from "@/lib/catalog";
import { CONCERNS, SKIN_TYPES, SORTS, SITE, type Sort } from "@/lib/constants";
import { Breadcrumbs, container } from "@/components/site/section";
import { JsonLd } from "@/components/json-ld";
import { ProductGrid, GridSkeleton } from "./product-grid";
import { SortSelect } from "./sort-select";
import { cn } from "@/lib/utils";

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** Shared catalogue listing (shop, category, concern). Filters come from the URL. */
export function Listing({ title, intro, crumbs, base, fixed, searchParams }: {
  title: string; intro?: string; crumbs: { name: string; href?: string }[]; base: string;
  fixed: { category?: string; concern?: string }; searchParams: SP;
}) {
  return (
    <div className={`${container} pt-6`}>
      <Breadcrumbs items={crumbs} />
      <header className="mt-6 mb-8 max-w-2xl">
        <h1 className="font-heading text-[40px] leading-none lg:text-6xl">{title}</h1>
        {intro && <p className="mt-4 text-muted-foreground">{intro}</p>}
      </header>
      <Suspense fallback={null}><CategoryChips active={fixed.category} /></Suspense>
      <Suspense fallback={<GridSkeleton count={8} />}><Results base={base} fixed={fixed} searchParams={searchParams} /></Suspense>
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: crumbs.map((c, i) => ({ "@type": "ListItem", position: i + 1, name: c.name, item: `${SITE.url}${c.href ?? base}` })),
      }} />
    </div>
  );
}

/** Fallback while URL params resolve (keeps listing pages on the instant static shell). */
export function ListingSkeleton() {
  return (
    <div className={`${container} pt-6`} aria-hidden>
      <div className="h-3 w-32 rounded bg-sand" />
      <div className="mt-6 mb-8 h-12 w-64 rounded bg-sand" />
      <GridSkeleton count={8} />
    </div>
  );
}

async function CategoryChips({ active }: { active?: string }) {
  const cats = await getCategories();
  const chip = (on: boolean) => cn("eyebrow shrink-0 rounded-full border px-4 py-2.5 transition-colors", on ? "border-foreground bg-foreground text-background" : "border-foreground/20 hover:border-foreground");
  return (
    <nav aria-label="Categories" className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
      <Link href="/shop" className={chip(!active)}>All</Link>
      {cats.map((c) => <Link key={c.id} href={`/shop/${c.slug}`} className={chip(active === c.slug)}>{c.name}</Link>)}
      <Link href="/bundles" className={chip(false)}>Bundles</Link>
    </nav>
  );
}

async function Results({ base, fixed, searchParams }: { base: string; fixed: { category?: string; concern?: string }; searchParams: SP }) {
  const sp = await searchParams;
  const sort = (one(sp.sort) ?? "featured") as Sort;
  const skin = one(sp.skin);
  const q = one(sp.q)?.trim().slice(0, 60) || undefined;
  const concern = fixed.concern ?? one(sp.concern);
  const filters = {
    category: fixed.category,
    concern: CONCERNS.some((c) => c.slug === concern) ? concern : undefined,
    skinType: (SKIN_TYPES as readonly string[]).includes(skin ?? "") ? skin : undefined,
    q, sort: sort in SORTS ? sort : "featured",
  };
  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-y py-3">
        <p className="text-sm text-muted-foreground">{q ? <>Results for “{q}”</> : "Filter & sort"}</p>
        <SortSelect base={base} sort={filters.sort} skin={filters.skinType} q={q} />
      </div>
      <ProductGrid filters={filters} priorityCount={4} empty={
        <div className="py-20 text-center">
          <p className="font-heading text-3xl">Nothing matches yet</p>
          <p className="mt-2 text-muted-foreground">Try a different search or browse everything.</p>
          <Link href="/shop" className="eyebrow mt-6 inline-block underline underline-offset-4">View all products</Link>
        </div>
      } />
    </>
  );
}

