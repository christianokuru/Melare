"use client";
import Link from "next/link";
import { track } from "@/lib/track";
import { useAddToBag } from "./use-add-to-bag";
import { cn } from "@/lib/utils";

const btn = "mt-3 flex h-11 w-full items-center justify-center rounded-full border border-foreground/20 text-[11px] uppercase tracking-[0.14em] transition-colors hover:bg-foreground hover:text-background disabled:opacity-50";

export function QuickAdd({ variantId, inStock, multiple, slug, tracking }: {
  variantId: string; inStock: boolean; multiple: boolean; slug: string;
  tracking: { id: string; name: string; price: number; currency: string };
}) {
  const { add, pending } = useAddToBag();
  if (!inStock) return <Link href={`/products/${slug}`} className={cn(btn, "text-muted-foreground")}>Notify me</Link>;
  if (multiple) return <Link href={`/products/${slug}`} className={btn}>Choose size</Link>;
  return (
    <button type="button" disabled={pending} className={btn} onClick={() => add({ variantId, quantity: 1 }, "Added to your bag",
      () => track("add_to_cart", tracking.currency, tracking.price, [{ item_id: tracking.id, item_name: tracking.name, price: tracking.price, quantity: 1 }]))}>
      {pending ? "Adding…" : "Add to bag"}
    </button>
  );
}
