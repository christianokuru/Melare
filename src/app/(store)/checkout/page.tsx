import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { asc, desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getCart } from "@/lib/cart";
import { getSession } from "@/lib/auth";
import { getCurrency } from "@/lib/request";
import { lineUnit } from "@/lib/checkout";
import { quoteCheckout } from "@/app/actions/checkout";
import { buttonPrimary, container } from "@/components/site/section";
import { CheckoutForm } from "@/components/checkout/checkout-form";

export const metadata: Metadata = { title: "Checkout", robots: { index: false, follow: false } };

export default function CheckoutPage() {
  return (
    <div className={`${container} pt-8`}>
      <h1 className="mb-8 font-heading text-[40px] leading-none lg:text-5xl">Checkout</h1>
      <Suspense fallback={<div className="h-96 animate-pulse rounded-2xl bg-sand" />}><Checkout /></Suspense>
    </div>
  );
}

async function Checkout() {
  const [{ lines }, session, currency] = await Promise.all([getCart(), getSession(), getCurrency()]);
  if (!lines.length || lines.some((l) => l.maxQty < l.quantity)) {
    return (
      <div className="py-10 text-center">
        <p className="font-heading text-3xl">{lines.length ? "Some items in your bag changed" : "Your bag is empty"}</p>
        <p className="mt-2 text-muted-foreground">{lines.length ? "Please review availability in your bag before checking out." : "Add something you love to check out."}</p>
        <Link href={lines.length ? "/cart" : "/shop"} className={`${buttonPrimary} mt-6`}>{lines.length ? "Review my bag" : "Shop now"}</Link>
      </div>
    );
  }
  const [saved] = session
    ? await db.select().from(s.addresses).where(eq(s.addresses.userId, session.user.id)).orderBy(desc(s.addresses.isDefault), asc(s.addresses.createdAt)).limit(1)
    : [];
  const initial = {
    fullName: saved?.fullName ?? session?.user.name ?? "", phone: saved?.phone ?? session?.user.phone ?? "",
    line1: saved?.line1 ?? "", line2: saved?.line2 ?? "", city: saved?.city ?? "", state: saved?.state ?? "",
    country: saved?.country ?? (currency === "NGN" ? "NG" : "US"), postalCode: saved?.postalCode ?? "",
  };
  const quote = await quoteCheckout({ country: initial.country, state: initial.state });
  if ("error" in quote) return <p className="text-destructive">{quote.error}</p>;
  return (
    <CheckoutForm email={session?.user.email ?? null} initial={initial} currency={currency} initialQuote={quote}
      lines={lines.map((l) => ({ id: l.refId, name: l.name, label: l.label, quantity: l.quantity, total: lineUnit(l, currency) * l.quantity }))} />
  );
}
