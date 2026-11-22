"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { addToCart } from "@/app/actions/cart";

/** Shared add-to-bag behaviour: server action, success toast with "View bag", error toast. */
export function useAddToBag() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const add = (input: Parameters<typeof addToCart>[0], message: string, onAdded?: () => void) =>
    start(async () => {
      const r = await addToCart(input);
      if (!r.ok) return void toast.error(r.error);
      toast.success(message, { action: { label: "View bag", onClick: () => router.push("/cart") } });
      onAdded?.();
    });
  return { add, pending };
}
