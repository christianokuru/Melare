"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { addToCart } from "@/app/actions/cart";
import { buttonPrimary } from "@/components/site/section";
import { cn } from "@/lib/utils";

export function BundleBuy({ bundleId, available, label, className }: { bundleId: string; available: boolean; label: string; className?: string }) {
  const [pending, start] = useTransition();
  if (!available) return <p className="rounded-xl bg-blush p-4 text-sm">This ritual is temporarily unavailable. Shop the products individually below.</p>;
  return (
    <button type="button" disabled={pending} className={cn(buttonPrimary, className)} onClick={() => start(async () => {
      const r = await addToCart({ bundleId, quantity: 1 });
      if (r.ok) toast.success("Ritual added to your bag", { action: { label: "View bag", onClick: () => (window.location.href = "/cart") } });
      else toast.error(r.error);
    })}>{pending ? "Adding…" : label}</button>
  );
}
