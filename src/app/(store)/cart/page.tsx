import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getCart } from "@/lib/cart";
import { getCurrency } from "@/lib/request";
import { getShippingZones } from "@/lib/catalog";
import { formatMoney } from "@/lib/money";
import { lineUnit, subtotalOf } from "@/lib/checkout";
import { buttonPrimary, container } from "@/components/site/section";
import { CartLineRow } from "@/components/cart/cart-line";
import { ProductGrid, GridSkeleton } from "@/components/product/product-grid";
import { cn } from "@/lib/utils";
import { providerNames } from "@/lib/gateways";

export const metadata: Metadata = { title: "Your bag", robots: { index: false, follow: true } };

export default function CartPage() {
  return (
    <div className={`${container} pt-8`}>
      <h1 className="font-heading text-[40px] leading-none lg:text-6xl">Your bag</h1>
      <Suspense fallback={<div className="mt-10 h-60 animate-pulse rounded-2xl bg-sand" />}><Bag /></Suspense>
    </div>
  );
}

async function Bag() {
  const [{ lines, count }, currency, zones] = await Promise.all([getCart(), getCurrency(), getShippingZones()]);
  if (!lines.length) {
    return (
      <>
        <div className="py-14 text-center">
          <p className="font-heading text-3xl">Your bag is empty</p>
          <p className="mt-2 text-muted-foreground">Let’s find something your skin will love.</p>
          <Link href="/shop" className={`${buttonPrimary} mt-6`}>Shop bestsellers</Link>
        </div>
        <Suspense fallback={<GridSkeleton />}><ProductGrid limit={4} /></Suspense>
      </>
    );
  }
  const subtotal = subtotalOf(lines, currency);
  const blocked = lines.some((l) => l.maxQty < l.quantity);
  // Free-delivery nudge: Lagos threshold for naira shoppers, international for dollar shoppers.
  const zone = currency === "NGN" ? zones.find((z) => z.country === "NG" && z.state) : zones.find((z) => z.country === "*");
  const threshold = zone ? (currency === "NGN" ? zone.freeOverNgn : zone.freeOverUsd) : null;
  const remaining = threshold ? Math.max(0, threshold - subtotal) : 0;

  return (
    <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_400px]">
      <div>
        {threshold && zone && (
          <div className="rounded-2xl bg-blush p-4">
            <p className="text-sm">{remaining > 0 ? <>You’re <strong>{formatMoney(remaining, currency)}</strong> away from free {zone.name === "International" ? "international" : zone.name} delivery</> : <>You’ve unlocked free {zone.name === "International" ? "international" : zone.name} delivery ✦</>}</p>
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.min(100, (subtotal / threshold) * 100))} aria-label="Progress to free delivery">
              <div className="h-full rounded-full bg-foreground transition-all" style={{ width: `${Math.min(100, (subtotal / threshold) * 100)}%` }} />
            </div>
          </div>
        )}
        <ul className="divide-y border-b">
          {lines.map((l) => <CartLineRow key={l.id} currency={currency} line={{ ...l, unit: lineUnit(l, currency) }} />)}
        </ul>
      </div>
      <aside className="h-fit rounded-2xl border p-6 lg:sticky lg:top-24">
        <h2 className="font-heading text-2xl">Summary</h2>
        <dl className="mt-4 grid gap-2 text-sm">
          <div className="flex justify-between"><dt>Subtotal ({count} item{count > 1 ? "s" : ""})</dt><dd>{formatMoney(subtotal, currency)}</dd></div>
          <div className="flex justify-between text-muted-foreground"><dt>Delivery</dt><dd>Calculated at checkout</dd></div>
        </dl>
        <Link href="/checkout" aria-disabled={blocked} className={cn(buttonPrimary, "mt-6 w-full", blocked && "pointer-events-none opacity-40")}>Checkout securely</Link>
        {blocked && <p className="mt-2 text-xs text-destructive">Update the highlighted items to continue.</p>}
        <p className="mt-4 text-center text-xs text-muted-foreground">Pay by card, bank transfer or USSD · Secured by {providerNames()}</p>
        <p className="mt-2 text-center text-xs text-muted-foreground">Have a promo or referral code? Add it at checkout.</p>
      </aside>
    </div>
  );
}
