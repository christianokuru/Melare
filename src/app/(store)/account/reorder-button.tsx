"use client";
import { useAddToBag } from "@/components/product/use-add-to-bag";

export function ReorderButton({ variantId, name }: { variantId: string; name: string }) {
  const { add, pending } = useAddToBag();
  return (
    <button type="button" disabled={pending} onClick={() => add({ variantId, quantity: 1 }, `${name} added to your bag`)}
      className="eyebrow rounded-full bg-foreground px-4 py-2.5 text-background disabled:opacity-50">{pending ? "Adding…" : "Reorder"}</button>
  );
}
