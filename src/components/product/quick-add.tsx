"use client";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { addToCart } from "@/app/actions/cart";
import { track } from "@/lib/track";
import { cn } from "@/lib/utils";

const btn = "mt-3 flex h-11 w-full items-center justify-center rounded-full border border-foreground/20 text-[11px] uppercase tracking-[0.14em] transition-colors hover:bg-foreground hover:text-background disabled:opacity-50";

export function QuickAdd({ variantId, inStock, multiple, slug, tracking }: {
  variantId: string; inStock: boolean; multiple: boolean; slug: string;
  tracking: { id: string; name: string; price: number; currency: string };
}) {
  const [pending, start] = useTransition();
  if (!inStock) return <Link href={`/products/${slug}`} className={cn(btn, "text-muted-foreground")}>Notify me</Link>;
  if (multiple) return <Link href={`/products/${slug}`} className={btn}>Choose size</Link>;
  return (
    <button type="button" disabled={pending} className={btn} onClick={() => start(async () => {
      const r = await addToCart({ variantId, quantity: 1 });
      if (r.ok) {
        toast.success("Added to your bag", { action: { label: "View bag", onClick: () => (window.location.href = "/cart") } });
        track("add_to_cart", tracking.currency, tracking.price, [{ item_id: tracking.id, item_name: tracking.name, price: tracking.price, quantity: 1 }]);
      } else toast.error(r.error);
    })}>
      {pending ? "Adding…" : "Add to bag"}
    </button>
  );
}
