import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { getBundles, getCategories } from "@/lib/catalog";
import { getCurrency } from "@/lib/request";
import { CONCERNS } from "@/lib/constants";
import { ARTICLES } from "@/content/journal";
import { ProductGrid, GridSkeleton } from "@/components/product/product-grid";
import { Price } from "@/components/product/price";
import { buttonOutline, buttonPrimary, container, SectionHeading } from "@/components/site/section";
import { media } from "@/lib/media";

export default function Home() {
  return (
    <>
      {/* Hero */}
      <section className="grid bg-petal lg:min-h-[calc(100svh-120px)] lg:grid-cols-2">
        <div className="relative order-1 h-[62svh] min-h-[420px] lg:order-2 lg:h-auto">
          <Image src={media("site/hero.webp")} alt="Woman with radiant, even, melanin-rich skin in warm light" fill priority sizes="(min-width:1024px) 50vw, 100vw" className="object-cover object-[50%_30%]" />
        </div>
        <div className="order-2 flex flex-col justify-center px-5 py-10 text-center lg:order-1 lg:px-[8vw] lg:text-left">
          <p className="eyebrow mb-4">Skincare for melanin-rich skin</p>
          <h1 className="font-heading text-[46px] leading-[0.98] sm:text-6xl lg:text-[84px]">Skin, but <em>rarer.</em></h1>
          <p className="mx-auto mt-5 max-w-md text-base lg:mx-0 lg:text-lg">Gentle, effective formulas that fade dark spots, even tone and bring out your natural glow, without harshness or bleaching.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center lg:justify-start">
            <Link href="/shop" className={buttonPrimary}>Shop bestsellers</Link>
            <Link href="/quiz" className={buttonOutline}>Take the skin quiz</Link>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <ul className="grid grid-cols-2 border-b text-center text-[11px] uppercase tracking-[0.1em] lg:grid-cols-4">
        {["Made for melanin-rich skin", "1–2 day Lagos delivery", "Shipped worldwide", "Pay by card, transfer or USSD"].map((t, i) => (
          <li key={t} className={`px-3 py-4 ${i % 2 === 0 ? "border-r" : ""} ${i < 2 ? "max-lg:border-b" : ""} lg:border-r lg:last:border-r-0`}>{t}</li>
        ))}
      </ul>

      {/* Concerns */}
      <section className="pt-16 lg:pt-24" aria-labelledby="concerns">
        <div className={container}><SectionHeading title={<span id="concerns">Shop by concern</span>} eyebrow="Start with what your skin needs" center /></div>
        <ul className="no-scrollbar flex gap-4 overflow-x-auto px-4 pb-2 lg:justify-center lg:gap-10">
          {CONCERNS.map((c) => (
            <li key={c.slug} className="shrink-0">
              <Link href={`/concerns/${c.slug}`} className="group flex w-[88px] flex-col items-center gap-2.5 text-center lg:w-[120px]">
                <span className="flex size-[80px] items-center justify-center rounded-full border border-gold/40 bg-blush font-heading text-3xl italic transition-colors group-hover:bg-petal lg:size-[112px] lg:text-[44px]">{c.letter}</span>
                <span className="text-[12px] leading-tight lg:text-[13px] lg:uppercase lg:tracking-[0.08em]">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Bestsellers */}
      <section className={`${container} pt-16 lg:pt-24`}>
        <SectionHeading title="Bestsellers" href="/shop" />
        <Suspense fallback={<GridSkeleton />}><ProductGrid limit={4} /></Suspense>
      </section>

      {/* Bundle */}
      <Suspense fallback={<div className="mt-20 h-[600px] bg-blush" />}><FeaturedBundle /></Suspense>

      {/* Categories */}
      <section className={`${container} pt-16 lg:pt-24`}>
        <SectionHeading title="Build your routine" eyebrow="Shop by category" />
        <Categories />
      </section>

      {/* Quiz */}
      <section className="mt-16 grid bg-blush lg:mt-24 lg:grid-cols-2">
        <div className="relative h-[420px] lg:h-auto lg:min-h-[560px]">
          <Image src={media("site/portrait-afro.webp")} alt="Woman with healthy, glowing skin" fill sizes="(min-width:1024px) 50vw, 100vw" className="object-cover object-top" />
        </div>
        <div className="flex flex-col items-center justify-center px-6 py-14 text-center lg:items-start lg:px-[7vw] lg:text-left">
          <p className="eyebrow mb-3 text-muted-foreground">2-minute skin quiz</p>
          <h2 className="font-heading text-[36px] leading-[1.05] lg:text-[52px]">Not sure where to <em>start?</em></h2>
          <p className="mt-4 mb-8 max-w-md">Answer five quick questions about your skin and we’ll build a routine that fits it. No guesswork, no wasted products.</p>
          <Link href="/quiz" className={buttonPrimary}>Find my routine</Link>
        </div>
      </section>

      {/* Journal */}
      <section className={`${container} pt-16 lg:pt-24`}>
        <SectionHeading title="The Journal" eyebrow="Skin education" href="/journal" linkLabel="All stories" />
        <div className="grid gap-8 md:grid-cols-3">
          {ARTICLES.map((a) => (
            <Link key={a.slug} href={`/journal/${a.slug}`} className="group">
              <div className="relative aspect-[3/2] overflow-hidden rounded-2xl bg-sand">
                <Image src={a.image} alt={a.imageAlt} fill sizes="(min-width:768px) 33vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
              </div>
              <p className="eyebrow mt-4 text-muted-foreground">{a.tag} · {a.readMinutes} min read</p>
              <h3 className="mt-1 font-heading text-2xl leading-tight group-hover:underline underline-offset-4">{a.title}</h3>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}

async function Categories() {
  const cats = await getCategories();
  return (
    <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 lg:mx-0 lg:grid lg:grid-cols-4 lg:gap-5 lg:px-0">
      {cats.map((c) => (
        <Link key={c.id} href={`/shop/${c.slug}`} className="group relative block w-[62vw] shrink-0 snap-start overflow-hidden rounded-t-[999px] rounded-b-2xl bg-sand sm:w-[40vw] lg:w-auto">
          <div className="relative aspect-[3/4]">
            {c.image && <Image src={c.image} alt="" fill sizes="(min-width:1024px) 25vw, 62vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.04]" />}
          </div>
          <span className="eyebrow absolute inset-x-3 bottom-3 rounded-full bg-background/90 py-2.5 text-center">{c.name}</span>
        </Link>
      ))}
    </div>
  );
}

async function FeaturedBundle() {
  const [currency, bundles] = await Promise.all([getCurrency(), getBundles()]);
  const b = bundles[0];
  if (!b) return null;
  const price = currency === "NGN" ? b.priceNgn : b.priceUsd;
  const sum = currency === "NGN" ? b.sumNgn : b.sumUsd;
  return (
    <section className="mt-16 grid bg-blush lg:mt-24 lg:grid-cols-2">
      <div className="flex items-end justify-center bg-petal px-8 pt-12">
        <div className="relative aspect-[4/5] w-full max-w-[420px] overflow-hidden rounded-t-[999px]">
          <Image src={b.image} alt={`${b.name} routine bundle`} fill sizes="(min-width:1024px) 420px, 90vw" className="object-cover" />
        </div>
      </div>
      <div className="flex flex-col justify-center px-6 py-14 lg:px-[7vw]">
        <p className="eyebrow mb-3 text-muted-foreground">Routine bundle · Save {b.discountPercent}%</p>
        <h2 className="font-heading text-[40px] leading-none lg:text-[56px]">{b.name}</h2>
        <p className="mt-4 max-w-md">{b.tagline}.</p>
        <ul className="mt-4 space-y-1 text-sm text-muted-foreground">{b.items.map((i) => <li key={i.variantId}>· {i.productName} ({i.label})</li>)}</ul>
        <Price amount={price} compareAt={sum} currency={currency} className="mt-6 text-xl" />
        <Link href={`/bundles/${b.slug}`} className={`${buttonPrimary} mt-6 self-start`}>Shop the ritual</Link>
      </div>
    </section>
  );
}
