import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CONCERNS } from "@/lib/constants";
import { Listing } from "@/components/product/listing";

export function generateStaticParams() {
  return CONCERNS.map((c) => ({ slug: c.slug }));
}

const find = (slug: string) => CONCERNS.find((c) => c.slug === slug);

export async function generateMetadata({ params }: PageProps<"/concerns/[slug]">): Promise<Metadata> {
  const c = find((await params).slug);
  if (!c) notFound();
  return {
    title: `Best Skincare for ${c.name} on Dark Skin`,
    description: `${c.blurb} Melaré skincare for ${c.name.toLowerCase()} on melanin-rich skin, delivered in Lagos, Nigeria and worldwide.`,
    alternates: { canonical: `/concerns/${c.slug}` },
  };
}

export default async function ConcernPage({ params, searchParams }: PageProps<"/concerns/[slug]">) {
  const c = find((await params).slug);
  if (!c) notFound();
  return <Listing title={c.name} intro={c.blurb} base={`/concerns/${c.slug}`} fixed={{ concern: c.slug }} searchParams={searchParams}
    crumbs={[{ name: "Home", href: "/" }, { name: "Concerns" }, { name: c.name }]} />;
}
