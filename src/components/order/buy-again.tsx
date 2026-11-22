"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { buyAgain } from "@/app/actions/cart";

/** Puts every still-available item from a past order back in the bag. */
export function BuyAgainButton({ number, className }: { number: string; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} className={className} onClick={() => start(async () => {
      const r = await buyAgain(number);
      if (!r.ok) return void toast.error(r.error);
      if (!r.added) return void toast.error("Sorry, these items aren’t available right now.");
      toast.success(`Added ${r.added} item${r.added === 1 ? "" : "s"} to your bag${r.unavailable ? ` · ${r.unavailable} no longer available` : ""}`,
        { action: { label: "View bag", onClick: () => router.push("/cart") } });
    })}>{pending ? "Adding…" : "Buy again"}</button>
  );
}
