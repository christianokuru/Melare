"use client";
import { useAddToBag } from "./use-add-to-bag";
import { buttonPrimary } from "@/components/site/section";
import { cn } from "@/lib/utils";

export function BundleBuy({ bundleId, available, label, className }: { bundleId: string; available: boolean; label: string; className?: string }) {
  const { add, pending } = useAddToBag();
  if (!available) return <p className="rounded-xl bg-blush p-4 text-sm">This ritual is temporarily unavailable. Shop the products individually below.</p>;
  return (
    <button type="button" disabled={pending} className={cn(buttonPrimary, className)} onClick={() => add({ bundleId, quantity: 1 }, "Ritual added to your bag")}>{pending ? "Adding…" : label}</button>
  );
}
