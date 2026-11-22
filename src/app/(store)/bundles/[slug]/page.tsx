import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getBundle, getBundles } from "@/lib/catalog";
import { getCurrency } from "@/lib/request";
import { formatMoney } from "@/lib/money";
import { SITE } from "@/lib/constants";
import { Breadcrumbs, container } from "@/components/site/section";
import { BundleBuy } from "@/components/product/bundle-buy";
import { JsonLd } from "@/components/json-ld";

export async function generateStaticParams() {
  return (await getBundles()).map((b) => ({ slug: b.slug }));
}

export async function generateMetadata({ params }: PageProps<"/bundles/[slug]">): Promise<Metadata> {
  const b = await getBundle((await params).slug);
  if (!b) return { title: "Not found", robots: { index: false } };
  return {
    title: `${b.name} · Save ${b.discountPercent}%`, description: b.description.slice(0, 158),
    alternates: { canonical: `/bundles/${b.slug}` }, openGraph: { images: [b.image] },
  };
}

export default function BundlePage({ params }: PageProps<"/bundles/[slug]">) {
  return <Suspense fallback={<div className="h-[70vh]" />}><Bundle params={params} /></Suspense>;
}

async function Bundle({ params }: { params: PageProps<"/bundles/[slug]">["params"] }) {
  const b = await getBundle((await params).slug);
  if (!b) notFound();
  const currency = await getCurrency();
  const price = currency === "NGN" ? b.priceNgn : b.priceUsd;
  const sum = currency === "NGN" ? b.sumNgn : b.sumUsd;
  return (
    <div className={`${container} pt-5`}>
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Bundles", href: "/bundles" }, { name: b.name }]} />
      <div className="mt-5 grid gap-8 lg:grid-cols-2 lg:gap-14">
        <div className="relative aspect-[4/5] overflow-hidden rounded-t-[999px] rounded-b-2xl bg-sand lg:aspect-square">
          <Image src={b.image} alt={`${b.name} routine bundle`} fill priority sizes="(min-width:1024px) 50vw, 100vw" className="object-cover" />
        </div>
        <div className="lg:self-center">
          <p className="eyebrow text-muted-foreground">Routine bundle · Save {b.discountPercent}%</p>
          <h1 className="mt-2 font-heading text-[42px] leading-none lg:text-6xl">{b.name}</h1>
          <p className="mt-4 text-lg">{b.tagline}</p>
          <p className="mt-6 flex items-baseline gap-3 text-2xl">{formatMoney(price, currency)} <s className="text-base text-muted-foreground">{formatMoney(sum, currency)}</s></p>
          <p className="mt-1 text-sm text-[#7a4a2a]">You save {formatMoney(sum - price, currency)}</p>
          <BundleBuy bundleId={b.id} available={b.available} label={`Add ritual to bag · ${formatMoney(price, currency)}`} className="mt-6 w-full" />
          <p className="mt-8 text-muted-foreground">{b.description}</p>
          <h2 className="eyebrow mt-8 mb-3">What’s inside</h2>
          <ul className="divide-y border-y">
            {b.items.map((i) => (
              <li key={i.variantId} className="flex items-center justify-between gap-4 py-3 text-sm">
                <Link href={`/products/${i.productSlug}`} className="underline-offset-4 hover:underline">{i.productName} <span className="text-muted-foreground">· {i.label}{i.quantity > 1 ? ` × ${i.quantity}` : ""}</span></Link>
                <span className="text-muted-foreground">{formatMoney((currency === "NGN" ? i.priceNgn : i.priceUsd) * i.quantity, currency)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "Product", name: b.name, description: b.description, image: `${SITE.url}${b.image}`, brand: { "@type": "Brand", name: SITE.name },
        offers: [
          { "@type": "Offer", price: (b.priceNgn / 100).toFixed(2), priceCurrency: "NGN", availability: b.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: `${SITE.url}/bundles/${b.slug}` },
          { "@type": "Offer", price: (b.priceUsd / 100).toFixed(2), priceCurrency: "USD", availability: b.available ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: `${SITE.url}/bundles/${b.slug}` },
        ],
      }} />
    </div>
  );
}
