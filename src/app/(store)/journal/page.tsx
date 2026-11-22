import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ARTICLES } from "@/content/journal";
import { Breadcrumbs, container } from "@/components/site/section";

export const metadata: Metadata = {
  title: "The Journal · Skincare Advice for Melanin-Rich Skin",
  description: "Expert, practical guides on fading dark spots, sunscreen for dark skin and building a simple routine for Black and brown skin.",
  alternates: { canonical: "/journal" },
};

export default function JournalPage() {
  return (
    <div className={`${container} pt-6`}>
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Journal" }]} />
      <h1 className="mt-6 mb-10 font-heading text-[40px] leading-none lg:text-6xl">The Journal</h1>
      <div className="grid gap-10 md:grid-cols-3">
        {ARTICLES.map((a, i) => (
          <Link key={a.slug} href={`/journal/${a.slug}`} className="group">
            <div className="relative aspect-[3/2] overflow-hidden rounded-2xl bg-sand">
              <Image src={a.image} alt={a.imageAlt} fill priority={i === 0} sizes="(min-width:768px) 33vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
            </div>
            <p className="eyebrow mt-4 text-muted-foreground">{a.tag} · {a.readMinutes} min read</p>
            <h2 className="mt-1 font-heading text-2xl leading-tight group-hover:underline underline-offset-4">{a.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{a.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
