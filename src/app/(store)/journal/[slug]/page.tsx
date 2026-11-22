import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ARTICLES, getArticle } from "@/content/journal";
import { getProducts } from "@/lib/catalog";
import { getCurrency } from "@/lib/request";
import { SITE } from "@/lib/constants";
import { Breadcrumbs, buttonPrimary, container } from "@/components/site/section";
import { ProductCard } from "@/components/product/product-card";
import { JsonLd } from "@/components/json-ld";

export function generateStaticParams() {
  return ARTICLES.map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: PageProps<"/journal/[slug]">): Promise<Metadata> {
  const a = getArticle((await params).slug);
  if (!a) notFound();
  return {
    title: a.title, description: a.description, alternates: { canonical: `/journal/${a.slug}` },
    openGraph: { type: "article", title: a.title, description: a.description, publishedTime: a.published, images: [{ url: a.image, alt: a.imageAlt }] },
  };
}

export default async function ArticlePage({ params }: PageProps<"/journal/[slug]">) {
  const a = getArticle((await params).slug);
  if (!a) notFound();
  return (
    <article className={`${container} pt-6`}>
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Journal", href: "/journal" }, { name: a.title }]} />
      <header className="mx-auto mt-8 max-w-3xl text-center">
        <p className="eyebrow text-muted-foreground">{a.tag} · {a.readMinutes} min read · <time dateTime={a.published}>{new Date(a.published).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</time></p>
        <h1 className="mt-3 font-heading text-[40px] leading-[1.02] lg:text-6xl">{a.title}</h1>
        <p className="mt-4 text-lg text-muted-foreground">{a.description}</p>
      </header>
      <div className="relative mx-auto mt-10 aspect-[16/10] max-w-5xl overflow-hidden rounded-2xl bg-sand">
        <Image src={a.image} alt={a.imageAlt} fill priority sizes="(min-width:1024px) 1024px, 100vw" className="object-cover object-top" />
      </div>
      <div className="mx-auto mt-10 max-w-2xl text-[17px] leading-[1.75]">
        {a.sections.map((sec, i) => (
          <section key={i} className="mt-8">
            {sec.heading && <h2 className="mb-3 font-heading text-3xl">{sec.heading}</h2>}
            {sec.paragraphs.map((p, j) => <p key={j} className="mt-4">{p}</p>)}
            {sec.list && <ul className="mt-4 list-disc space-y-2 pl-5">{sec.list.map((li) => <li key={li}>{li}</li>)}</ul>}
          </section>
        ))}
        <p className="mt-10 rounded-2xl bg-blush p-5 text-sm">This article is for general education and isn’t a substitute for medical advice. See a dermatologist for persistent or changing skin concerns.</p>
        <div className="mt-8 text-center"><Link href="/quiz" className={buttonPrimary}>Find my routine</Link></div>
      </div>
      <section className="mt-20">
        <h2 className="mb-8 font-heading text-3xl lg:text-4xl">Shop the article</h2>
        <Suspense fallback={null}><Products slugs={a.products} /></Suspense>
      </section>
      <JsonLd data={{
        "@context": "https://schema.org", "@type": "Article", headline: a.title, description: a.description, image: `${SITE.url}${a.image}`,
        datePublished: a.published, author: { "@type": "Organization", name: SITE.name }, publisher: { "@id": `${SITE.url}/#org` },
        mainEntityOfPage: `${SITE.url}/journal/${a.slug}`,
      }} />
    </article>
  );
}

async function Products({ slugs }: { slugs: string[] }) {
  const [all, currency] = await Promise.all([getProducts(), getCurrency()]);
  const list = all.filter((p) => slugs.includes(p.slug));
  return <div className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-4">{list.map((p) => <ProductCard key={p.id} product={p} currency={currency} />)}</div>;
}
