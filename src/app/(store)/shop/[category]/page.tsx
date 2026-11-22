import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getCategories } from "@/lib/catalog";
import { Suspense } from "react";
import { Listing, ListingSkeleton } from "@/components/product/listing";

export async function generateStaticParams() {
  return (await getCategories()).map((c) => ({ category: c.slug }));
}

async function find(slug: string) {
  return (await getCategories()).find((c) => c.slug === slug) ?? null;
}

export async function generateMetadata({ params }: PageProps<"/shop/[category]">): Promise<Metadata> {
  const c = await find((await params).category);
  if (!c) notFound();
  return {
    title: `${c.name} for Melanin-Rich Skin`,
    description: c.description ?? `Shop Melaré ${c.name.toLowerCase()} made for Black and brown skin.`,
    alternates: { canonical: `/shop/${c.slug}` },
    openGraph: { title: `${c.name} · Melaré`, images: c.image ? [c.image] : undefined },
  };
}

export default function CategoryPage({ params, searchParams }: PageProps<"/shop/[category]">) {
  return <Suspense fallback={<ListingSkeleton />}><Category params={params} searchParams={searchParams} /></Suspense>;
}

async function Category({ params, searchParams }: Pick<PageProps<"/shop/[category]">, "params" | "searchParams">) {
  const c = await find((await params).category);
  if (!c) notFound();
  return <Listing title={c.name} intro={c.description ?? undefined} base={`/shop/${c.slug}`} fixed={{ category: c.slug }} searchParams={searchParams}
    crumbs={[{ name: "Home", href: "/" }, { name: "Shop", href: "/shop" }, { name: c.name }]} />;
}
