"use client";
import { useOptimistic, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { toggleWishlist } from "@/app/actions/store";
import { HeartIcon } from "@/components/site/icons";

export function WishlistButton({ productId, saved, signedIn }: { productId: string; saved: boolean; signedIn: boolean }) {
  const [optimistic, setOptimistic] = useOptimistic(saved);
  const [, start] = useTransition();
  const router = useRouter();
  return (
    <button type="button" aria-pressed={optimistic} aria-label={optimistic ? "Remove from favourites" : "Save to favourites"}
      className="flex size-11 items-center justify-center rounded-full border border-foreground/20"
      onClick={() => {
        if (!signedIn) return router.push(`/sign-in?next=${encodeURIComponent(location.pathname)}`);
        start(async () => {
          setOptimistic(!optimistic);
          const r = await toggleWishlist(productId);
          if (!r.ok) toast.error(r.error);
          else toast.success(r.saved ? "Saved to favourites" : "Removed from favourites");
        });
      }}>
      <HeartIcon filled={optimistic} width={18} height={18} />
    </button>
  );
}
