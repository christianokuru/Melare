import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getProducts } from "@/lib/catalog";
import { getCurrency } from "@/lib/request";
import { ProductCard } from "@/components/product/product-card";
import { GridSkeleton } from "@/components/product/product-grid";
import { buttonOutline, container } from "@/components/site/section";

export const metadata: Metadata = { title: "Your routine", robots: { index: false, follow: true } };

export default function ResultsPage({ searchParams }: PageProps<"/quiz/results">) {
  return (
    <div className={`${container} py-12`}>
      <p className="eyebrow text-center text-muted-foreground">Made for your skin</p>
      <h1 className="mt-2 mb-10 text-center font-heading text-[40px] leading-none lg:text-5xl">Your Melaré routine</h1>
      <Suspense fallback={<GridSkeleton />}><Results searchParams={searchParams} /></Suspense>
      <div className="mt-12 text-center"><Link href="/quiz" className={buttonOutline}>Retake the quiz</Link></div>
    </div>
  );
}

async function Results({ searchParams }: { searchParams: PageProps<"/quiz/results">["searchParams"] }) {
  const raw = (await searchParams).p;
  const slugs = (typeof raw === "string" ? raw : "").split(",").filter((x) => /^[a-z0-9-]{2,80}$/.test(x)).slice(0, 6);
  const [all, currency] = await Promise.all([getProducts(), getCurrency()]);
  const picked = slugs.map((sl) => all.find((p) => p.slug === sl)).filter((p) => !!p);
  if (!picked.length) return <p className="text-center text-muted-foreground">We couldn’t load your routine. <Link href="/quiz" className="underline">Take the quiz</Link>.</p>;
  return (
    <ol className="grid grid-cols-2 gap-x-3 gap-y-10 md:grid-cols-3 lg:grid-cols-5">
      {picked.map((p, i) => <li key={p.id}><p className="eyebrow mb-2 text-muted-foreground">Step {i + 1}</p><ProductCard product={p} currency={currency} /></li>)}
    </ol>
  );
}
