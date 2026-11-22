import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getProduct, getProducts, getRelated, getReviews, getShippingZones } from "@/lib/catalog";
import { getCurrency } from "@/lib/request";
import { getSession } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { CONCERNS, SITE, whatsappLink } from "@/lib/constants";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Breadcrumbs, container, SectionHeading } from "@/components/site/section";
import { ProductBuy } from "@/components/product/product-buy";
import { ProductCard } from "@/components/product/product-card";
import { WishlistButton } from "@/components/product/wishlist-button";
import { ReviewForm } from "@/components/product/review-form";
import { Stars } from "@/components/product/stars";
import { JsonLd } from "@/components/json-ld";
import { ChatIcon, TruckIcon } from "@/components/site/icons";

export async function generateStaticParams() {
  return (await getProducts()).map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/products/[slug]">): Promise<Metadata> {
  const p = await getProduct((await params).slug);
  if (!p) notFound();
  const title = p.seoTitle ?? `${p.name} · ${p.tagline}`;
  const description = p.seoDescription ?? `${p.description.slice(0, 150)}…`;
  return {
    title, description,
    alternates: { canonical: `/products/${p.slug}` },
    openGraph: { type: "website", title, description, images: p.images.slice(0, 1).map((i) => ({ url: i.src, alt: i.alt })) },
  };
}

export default function ProductPage({ params }: PageProps<"/products/[slug]">) {
  return <Suspense fallback={<PdpSkeleton />}><Product params={params} /></Suspense>;
}

async function Product({ params }: { params: PageProps<"/products/[slug]">["params"] }) {
  const p = await getProduct((await params).slug);
  if (!p) notFound();
  const [currency, reviews] = await Promise.all([getCurrency(), getReviews(p.id)]);
  const path = `/products/${p.slug}`;
  const concerns = CONCERNS.filter((c) => p.concerns.includes(c.slug));
  const variants = p.variants.map((v) => ({
    id: v.id, label: v.label, stock: v.stock,
    price: currency === "NGN" ? v.priceNgn : v.priceUsd,
    compareAt: currency === "NGN" ? v.compareAtNgn : v.compareAtUsd,
  }));

  return (
    <div className={`${container} pt-5`}>
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Shop", href: "/shop" }, ...(p.category ? [{ name: p.category.name, href: `/shop/${p.category.slug}` }] : []), { name: p.name }]} />

      <div className="mt-5 grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:gap-14">
        {/* Gallery: swipe on mobile, stacked grid on desktop */}
        <div className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-2 overflow-x-auto px-4 lg:mx-0 lg:grid lg:grid-cols-2 lg:gap-3 lg:overflow-visible lg:px-0">
          {p.images.map((im, i) => (
            <div key={im.id} className={`relative aspect-[4/5] w-[88vw] shrink-0 snap-center overflow-hidden rounded-2xl bg-sand lg:w-auto ${i === 0 ? "lg:col-span-2" : ""}`}>
              <Image src={im.src} alt={im.alt} fill priority={i === 0} sizes="(min-width:1024px) 50vw, 88vw" className="object-cover" />
            </div>
          ))}
        </div>

        <div className="lg:sticky lg:top-24 lg:self-start">
          {p.category && <Link href={`/shop/${p.category.slug}`} className="eyebrow text-muted-foreground hover:underline">{p.category.name}</Link>}
          <div className="mt-2 flex items-start justify-between gap-4">
            <h1 className="font-heading text-[38px] leading-[1.02] lg:text-5xl">{p.name}</h1>
            <Suspense fallback={<span className="size-11 shrink-0" />}><Wishlist productId={p.id} /></Suspense>
          </div>
          <p className="mt-2 text-muted-foreground">{p.tagline}</p>
          {p.reviewCount > 0 && (
            <a href="#reviews" className="mt-3 inline-flex items-center gap-2 text-sm"><Stars rating={p.rating} /> {p.rating} · {p.reviewCount} review{p.reviewCount > 1 ? "s" : ""}</a>
          )}
          <div className="mt-6"><ProductBuy productId={p.id} name={p.name} variants={variants} currency={currency} /></div>

          <ul className="mt-6 grid gap-2 text-sm">
            {p.benefits.map((b) => <li key={b} className="flex gap-2"><span className="text-gold" aria-hidden>✦</span>{b}</li>)}
          </ul>

          {concerns.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-2">
              {concerns.map((c) => <Link key={c.slug} href={`/concerns/${c.slug}`} className="rounded-full bg-blush px-3 py-1.5 text-xs">{c.name}</Link>)}
              {p.skinTypes.length >= 4 ? <span className="rounded-full bg-sand px-3 py-1.5 text-xs">All skin types</span>
                : p.skinTypes.map((t) => <span key={t} className="rounded-full bg-sand px-3 py-1.5 text-xs">{t} skin</span>)}
            </div>
          )}

          <Suspense fallback={null}><Delivery /></Suspense>

          <Accordion className="mt-6 border-t">
            {[
              ["Description", p.description],
              ["Key ingredients", p.ingredients],
              ["How to use", p.howToUse],
              ["Shipping & returns", "Orders are packed within 24 hours on business days. Unopened products can be returned within 14 days. See our shipping and returns pages for details."],
            ].filter(([, v]) => v).map(([k, v]) => (
              <AccordionItem key={k} value={k!} className="border-b">
                <AccordionTrigger className="py-4 text-[13px] uppercase tracking-[0.1em] hover:no-underline">{k}</AccordionTrigger>
                <AccordionContent className="pb-5 text-[15px] leading-relaxed text-muted-foreground">{v}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>

          <a href={whatsappLink(`Hi Melaré, I have a question about ${p.name}.`)} target="_blank" rel="noopener noreferrer"
            className="mt-6 flex items-center gap-3 rounded-2xl bg-blush p-4 text-sm"><ChatIcon /> <span>Not sure it’s right for you? <u>Ask us on WhatsApp</u></span></a>
        </div>
      </div>

      {/* Reviews */}
      <section id="reviews" className="mt-20 scroll-mt-24" aria-labelledby="reviews-title">
        <SectionHeading title={<span id="reviews-title">Reviews</span>} eyebrow={p.reviewCount ? `${p.rating} average · ${p.reviewCount} verified` : "Verified buyers"} />
        {reviews.length ? (
          <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {reviews.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 rounded-2xl bg-blush p-6">
                <Stars rating={r.rating} />
                <p className="font-heading text-xl leading-snug">{r.title}</p>
                <p className="text-sm text-muted-foreground">{r.body}</p>
                <p className="mt-auto flex justify-between text-xs"><span>{r.authorName} · Verified buyer</span><span className="text-muted-foreground">{r.skinType} skin</span></p>
              </li>
            ))}
          </ul>
        ) : <p className="text-muted-foreground">No reviews yet. Bought this? Be the first to share how it worked for your skin.</p>}
        <div className="mt-8"><Suspense fallback={null}><ReviewCta productId={p.id} path={path} /></Suspense></div>
      </section>

      <Suspense fallback={null}><Related productId={p.id} concerns={p.concerns} /></Suspense>

      <JsonLd data={{
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Product", name: p.name, description: p.description, sku: p.variants[0]?.sku, brand: { "@type": "Brand", name: SITE.name },
            image: p.images.map((i) => `${SITE.url}${i.src}`), url: `${SITE.url}${path}`, category: p.category?.name,
            offers: p.variants.flatMap((v) => [
              { "@type": "Offer", sku: v.sku, price: (v.priceNgn / 100).toFixed(2), priceCurrency: "NGN", availability: v.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: `${SITE.url}${path}`, itemCondition: "https://schema.org/NewCondition" },
              { "@type": "Offer", sku: v.sku, price: (v.priceUsd / 100).toFixed(2), priceCurrency: "USD", availability: v.stock > 0 ? "https://schema.org/InStock" : "https://schema.org/OutOfStock", url: `${SITE.url}${path}`, itemCondition: "https://schema.org/NewCondition" },
            ]),
            ...(p.reviewCount ? {
              aggregateRating: { "@type": "AggregateRating", ratingValue: p.rating, reviewCount: p.reviewCount },
              review: reviews.slice(0, 5).map((r) => ({ "@type": "Review", reviewRating: { "@type": "Rating", ratingValue: r.rating }, author: { "@type": "Person", name: r.authorName }, name: r.title, reviewBody: r.body })),
            } : {}),
          },
          {
            "@type": "BreadcrumbList", itemListElement: [
              { "@type": "ListItem", position: 1, name: "Home", item: SITE.url },
              { "@type": "ListItem", position: 2, name: "Shop", item: `${SITE.url}/shop` },
              { "@type": "ListItem", position: 3, name: p.name, item: `${SITE.url}${path}` },
            ],
          },
        ],
      }} />
    </div>
  );
}

async function Wishlist({ productId }: { productId: string }) {
  const session = await getSession();
  const saved = session ? (await db.select().from(s.wishlist).where(and(eq(s.wishlist.userId, session.user.id), eq(s.wishlist.productId, productId)))).length > 0 : false;
  return <WishlistButton productId={productId} saved={saved} signedIn={!!session} />;
}

async function ReviewCta({ productId, path }: { productId: string; path: string }) {
  const session = await getSession();
  return <ReviewForm productId={productId} signedIn={!!session} path={path} />;
}

async function Delivery() {
  const [currency, zones] = await Promise.all([getCurrency(), getShippingZones()]);
  return (
    <div className="mt-6 rounded-2xl border p-4 text-sm">
      <p className="mb-2 flex items-center gap-2 font-medium"><TruckIcon width={18} /> Delivery</p>
      <ul className="grid gap-1 text-muted-foreground">
        {zones.map((z) => {
          const free = currency === "NGN" ? z.freeOverNgn : z.freeOverUsd;
          return <li key={z.id} className="flex justify-between gap-3"><span>{z.name}: {z.eta}</span>{free != null && <span className="shrink-0">Free over {formatMoney(free, currency)}</span>}</li>;
        })}
      </ul>
    </div>
  );
}

async function Related({ productId, concerns }: { productId: string; concerns: string[] }) {
  const [currency, related] = await Promise.all([getCurrency(), getRelated(productId, concerns)]);
  if (!related.length) return null;
  return (
    <section className="mt-20">
      <SectionHeading title="Complete your routine" href="/shop" />
      <div className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-4 lg:gap-x-5">
        {related.map((r) => <ProductCard key={r.id} product={r} currency={currency} />)}
      </div>
    </section>
  );
}

function PdpSkeleton() {
  return (
    <div className={`${container} grid gap-8 pt-14 lg:grid-cols-[1.15fr_1fr]`} aria-hidden>
      <div className="aspect-[4/5] animate-pulse rounded-2xl bg-sand" />
      <div className="space-y-4"><div className="h-10 w-2/3 rounded bg-sand" /><div className="h-4 w-1/2 rounded bg-sand" /><div className="h-12 rounded-full bg-sand" /></div>
    </div>
  );
}
