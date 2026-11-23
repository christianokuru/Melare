import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { Contrast, Droplet, Droplets, Feather, Sparkle, Sun, type LucideIcon } from "lucide-react";
import { getBundles, getCategories, getProducts, getReviewHighlights } from "@/lib/catalog";
import { getCurrency } from "@/lib/request";
import { CONCERNS } from "@/lib/constants";
import { formatMoney, priceIn } from "@/lib/money";
import { ARTICLES } from "@/content/journal";
import { GridSkeleton } from "@/components/product/product-grid";
import { ProductCard } from "@/components/product/product-card";
import { Price } from "@/components/product/price";
import { Stars } from "@/components/product/stars";
import { HeroAdd, HomeTabs } from "@/components/home/home-client";
import { GlobeIcon, LeafIcon, ShieldIcon, TruckIcon } from "@/components/site/icons";
import { buttonOutline, buttonPrimary, container, SectionHeading } from "@/components/site/section";
import { media } from "@/lib/media";

const CONCERN_ICONS: Record<string, LucideIcon> = {
  "dark-spots": Sparkle, breakouts: Droplet, dullness: Sun, dryness: Droplets, "uneven-tone": Contrast, sensitivity: Feather,
};
const TRUST = [
  { icon: LeafIcon, text: "Made for melanin-rich skin" },
  { icon: TruckIcon, text: "1–2 day Lagos delivery" },
  { icon: GlobeIcon, text: "Shipped worldwide" },
  { icon: ShieldIcon, text: "Pay by card, transfer or USSD" },
];
const INGREDIENTS = [
  { name: "Niacinamide + tranexamic acid", text: "Fade dark spots and post-acne marks gently, without bleaching.", href: "/concerns/dark-spots" },
  { name: "Ceramides + shea butter", text: "Rebuild and protect your barrier for lasting, comfortable hydration.", href: "/concerns/dryness" },
  { name: "Marula, baobab & rosehip oils", text: "Nourishing African botanicals for a healthy, lit-from-within glow.", href: "/concerns/dullness" },
];
const fadeUp = "motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-4 motion-safe:duration-700 motion-safe:fill-mode-both";

export default function Home() {
  return (
    <>
      {/* Hero: arch-framed portrait, shoppable card, compact on phones so the CTA shows without scrolling */}
      <section className="overflow-hidden bg-petal">
        <div className={`${container} grid items-center gap-6 pt-6 pb-10 lg:min-h-[calc(100svh-120px)] lg:grid-cols-2 lg:gap-16 lg:py-14`}>
          <div className="relative order-1 mx-auto w-[min(50vw,230px)] lg:order-2 lg:w-full lg:max-w-[500px]">
            <span className="absolute -inset-2.5 rounded-t-[999px] rounded-b-[34px] border border-gold/50 lg:-inset-4 lg:rounded-b-[40px]" aria-hidden />
            <div className="relative aspect-[4/5] overflow-hidden rounded-t-[999px] rounded-b-[26px] bg-white shadow-[0_40px_70px_-35px_rgba(59,36,24,0.45)]">
              <Image src={media("site/hero-glow.webp")} alt="Woman with radiant, glowing deep brown skin in a cream head wrap and gold hoops" fill priority
                sizes="(min-width:1024px) 500px, 50vw" className="object-cover object-[50%_32%] motion-safe:animate-hero-zoom" />
            </div>
            <div className="max-lg:hidden"><Suspense fallback={null}><HeroProduct floating /></Suspense></div>
          </div>

          <div className={`order-2 text-center lg:order-1 lg:text-left ${fadeUp}`}>
            <NewPill />
            <h1 className="mt-4 font-heading text-[44px] leading-[0.98] sm:text-6xl lg:mt-6 lg:text-[84px]">Skin, but <em className="text-[#8A6623]">rarer.</em></h1>
            <p className="mx-auto mt-4 max-w-md text-[15px] lg:mx-0 lg:mt-5 lg:text-lg">Gentle, effective formulas that fade dark spots, even tone and bring out your natural glow, without harshness or bleaching.</p>
            <div className="mt-5 flex justify-center gap-3 lg:mt-8 lg:justify-start">
              <Link href="/shop" className={`${buttonPrimary} max-sm:flex-1 max-sm:px-4`}><span className="sm:hidden">Shop now</span><span className="max-sm:hidden">Shop bestsellers</span></Link>
              <Link href="/quiz" className={`${buttonOutline} max-sm:flex-1 max-sm:px-4`}><span className="sm:hidden">Skin quiz</span><span className="max-sm:hidden">Take the skin quiz</span></Link>
            </div>
            <ul className="mt-5 flex flex-wrap justify-center gap-2 lg:justify-start">
              {["Fades dark spots", "No bleaching", "Gentle for daily use"].map((b) => (
                <li key={b} className="flex items-center gap-1.5 rounded-full bg-background/70 px-3 py-1.5 text-xs"><span className="text-gold" aria-hidden>✦</span>{b}</li>
              ))}
            </ul>
            <RatingLine />
            <div className="mx-auto mt-6 max-w-[340px] lg:hidden"><Suspense fallback={null}><HeroProduct /></Suspense></div>
          </div>
        </div>
      </section>

      {/* Trust strip: static row on desktop, gentle marquee on phones */}
      <section aria-label="Why Melaré" className="border-b">
        <ul className="hidden grid-cols-4 lg:grid">
          {TRUST.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-center justify-center gap-2.5 border-r px-3 py-5 text-[11px] uppercase tracking-[0.1em] last:border-r-0"><Icon width={18} />{text}</li>
          ))}
        </ul>
        <div className="no-scrollbar overflow-hidden motion-reduce:overflow-x-auto lg:hidden">
          <ul className="flex w-max motion-safe:animate-marquee hover:[animation-play-state:paused]">
            {[...TRUST, ...TRUST].map(({ icon: Icon, text }, i) => (
              <li key={i} aria-hidden={i >= TRUST.length} className="flex shrink-0 items-center gap-2 px-6 py-4 text-[11px] uppercase tracking-[0.1em]"><Icon width={16} />{text}</li>
            ))}
          </ul>
        </div>
      </section>

      {/* Concerns */}
      <section className="pt-16 lg:pt-24" aria-labelledby="concerns">
        <div className={container}><SectionHeading title={<span id="concerns">Shop by concern</span>} eyebrow="Start with what your skin needs" center /></div>
        <ul className="no-scrollbar flex gap-4 overflow-x-auto px-4 pb-2 lg:justify-center lg:gap-10">
          {CONCERNS.map((c) => {
            const Icon = CONCERN_ICONS[c.slug] ?? Sparkle;
            return (
              <li key={c.slug} className="shrink-0">
                <Link href={`/concerns/${c.slug}`} className="group flex w-[88px] flex-col items-center gap-2.5 text-center lg:w-[120px]">
                  <span className="flex size-[80px] items-center justify-center rounded-full border border-gold/40 bg-blush transition-colors group-hover:bg-petal lg:size-[112px]">
                    <Icon className="size-7 text-[#8A6623] lg:size-9" strokeWidth={1.3} aria-hidden />
                  </span>
                  <span className="text-[12px] leading-tight lg:text-[13px] lg:uppercase lg:tracking-[0.08em]">{c.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Product tabs */}
      <section className={`${container} pt-16 lg:pt-24`}>
        <SectionHeading title="Loved right now" eyebrow="Shop the routine" href="/shop" />
        <Suspense fallback={<GridSkeleton />}><ProductTabs /></Suspense>
      </section>

      {/* Bundle */}
      <Suspense fallback={<div className="mt-20 h-[600px] bg-blush" />}><FeaturedBundle /></Suspense>

      {/* Reviews */}
      <Reviews />

      {/* Categories */}
      <section className={`${container} pt-16 lg:pt-24`}>
        <SectionHeading title="Build your routine" eyebrow="Shop by category" />
        <Categories />
      </section>

      {/* Ingredient spotlight */}
      <section className={`${container} pt-16 lg:pt-24`} aria-labelledby="ingredients">
        <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-20">
          <div className="relative mx-auto w-full max-w-[460px]">
            <div className="relative aspect-[4/5] overflow-hidden rounded-t-[999px] rounded-b-[26px] bg-sand">
              <Image src={media("site/apply-cream.webp")} alt="Applying a rich, gentle cream to glowing skin" fill sizes="(min-width:1024px) 460px, 90vw" className="object-cover" />
            </div>
          </div>
          <div>
            <p className="eyebrow mb-3 text-muted-foreground">What’s inside</p>
            <h2 id="ingredients" className="font-heading text-[36px] leading-[1.05] lg:text-[52px]">Proven actives, <em>African botanicals</em></h2>
            <p className="mt-4 max-w-md text-muted-foreground">Every formula pairs ingredients dermatologists trust with oils and butters our skin has loved for generations.</p>
            <ol className="mt-8 grid gap-6">
              {INGREDIENTS.map((it, i) => (
                <li key={it.name} className="flex gap-5 border-t pt-6">
                  <span className="font-heading text-3xl text-[#8A6623]" aria-hidden>0{i + 1}</span>
                  <div>
                    <h3 className="text-[13px] uppercase tracking-[0.1em]">{it.name}</h3>
                    <p className="mt-1.5 text-[15px] text-muted-foreground">{it.text}</p>
                    <Link href={it.href} className="eyebrow mt-2 inline-block underline underline-offset-4">Shop the edit</Link>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
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

/** "New · Product →" pill linking to the newest product (cached, part of the static shell). */
async function NewPill() {
  const [newest] = await getProducts({ sort: "newest" });
  if (!newest) return <p className="eyebrow">Skincare for melanin-rich skin</p>;
  return (
    <Link href={`/products/${newest.slug}`} className="inline-flex items-center gap-2 rounded-full bg-background/70 py-1.5 pr-3 pl-1.5 text-xs transition-colors hover:bg-background">
      <span className="eyebrow rounded-full bg-foreground px-2 py-0.5 text-[10px] text-background">New</span>{newest.name} <span aria-hidden>→</span>
    </Link>
  );
}

/** Real social proof only: hidden until there are approved reviews. */
async function RatingLine() {
  const { avg, count } = await getReviewHighlights();
  if (!count) return null;
  return (
    <a href="#reviews" className="mt-5 inline-flex items-center gap-2 text-sm">
      <Stars rating={avg} /> <span><strong>{avg.toFixed(1)}</strong> from {count} verified review{count === 1 ? "" : "s"}</span>
    </a>
  );
}

/** Shoppable bestseller card: floats on the hero image (desktop) or sits under the CTAs (phones, so they stay above the fold). */
async function HeroProduct({ floating }: { floating?: boolean }) {
  const [currency, products] = await Promise.all([getCurrency(), getProducts({ featured: true })]);
  const p = products.find((x) => x.inStock && x.defaultVariantId) ?? products[0];
  if (!p?.defaultVariantId) return null;
  return (
    <div className={`flex items-center gap-3 rounded-2xl bg-background/85 p-2.5 shadow-lg backdrop-blur-md ${floating ? "absolute -bottom-8 -left-14 w-[310px]" : "w-full"}`}>
      <Link href={`/products/${p.slug}`} className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-sand"><Image src={p.image} alt="" fill sizes="56px" className="object-cover" /></Link>
      <Link href={`/products/${p.slug}`} className="min-w-0 flex-1 text-left">
        <span className="eyebrow block text-[10px] text-muted-foreground">Bestseller</span>
        <span className="block truncate text-[13px] uppercase tracking-[0.06em]">{p.name}</span>
        <Price amount={priceIn(p, currency)} currency={currency} className="text-sm" />
      </Link>
      <HeroAdd variantId={p.defaultVariantId} name={p.name} slug={p.slug} multiple={p.variantCount > 1} />
    </div>
  );
}

/** Bestsellers / New / Under a price point: all rendered on the server, tabs only switch visibility. */
async function ProductTabs() {
  const [currency, all, newest] = await Promise.all([getCurrency(), getProducts(), getProducts({ sort: "newest" })]);
  const limit = currency === "NGN" ? 2000000 : 2500;
  const grid = (list: typeof all) => list.length ? (
    <div className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-4 lg:gap-x-5">
      {list.slice(0, 4).map((p, i) => <ProductCard key={p.id} product={p} currency={currency} priority={i < 2} />)}
    </div>
  ) : <p className="py-10 text-center text-muted-foreground">Nothing here right now.</p>;
  return (
    <HomeTabs tabs={[
      { label: "Bestsellers", content: grid(all) },
      { label: "New in", content: grid(newest) },
      { label: `Under ${formatMoney(limit, currency)}`, content: grid(all.filter((p) => priceIn(p, currency) < limit)) },
    ]} />
  );
}

/** Swipeable verified reviews (cached). */
async function Reviews() {
  const { avg, count, reviews } = await getReviewHighlights();
  if (!reviews.length) return null;
  return (
    <section id="reviews" className="scroll-mt-24 pt-16 lg:pt-24" aria-labelledby="reviews-title">
      <div className={container}>
        <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow mb-2 text-muted-foreground">Verified buyers</p>
            <h2 id="reviews-title" className="font-heading text-[32px] leading-none lg:text-[44px]">Real skin, real results</h2>
          </div>
          <p className="flex items-center gap-2 text-sm"><Stars rating={avg} /> {avg.toFixed(1)} average · {count} review{count === 1 ? "" : "s"}</p>
        </div>
      </div>
      <ul className="no-scrollbar flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-2 lg:scroll-px-10 lg:px-10">
        {reviews.map((r) => (
          <li key={r.id} className="flex w-[82vw] max-w-[360px] shrink-0 snap-start flex-col gap-3 rounded-2xl bg-blush p-6">
            <Stars rating={r.rating} />
            <p className="font-heading text-xl leading-snug">{r.title}</p>
            <p className="line-clamp-4 text-sm text-muted-foreground">{r.body}</p>
            <p className="mt-auto flex flex-wrap justify-between gap-2 pt-2 text-xs">
              <span>{r.authorName} · {r.skinType} skin</span>
              <Link href={`/products/${r.slug}#reviews`} className="underline underline-offset-4">{r.product}</Link>
            </p>
          </li>
        ))}
      </ul>
    </section>
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
