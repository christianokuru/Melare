"use client";
import Image from "next/image";
import Link from "next/link";
import { useTransition } from "react";
import { toast } from "sonner";
import { updateCartItem } from "@/app/actions/cart";
import { formatMoney, type Currency } from "@/lib/money";
import { MinusIcon, PlusIcon } from "@/components/site/icons";
import { cn } from "@/lib/utils";

export function CartLineRow({ line, currency }: {
  line: { id: string; name: string; label: string; image: string; href: string; quantity: number; maxQty: number; unit: number };
  currency: Currency;
}) {
  const [pending, start] = useTransition();
  const set = (quantity: number) => start(async () => { const r = await updateCartItem({ itemId: line.id, quantity }); if (!r.ok) toast.error(r.error); });
  const unavailable = line.maxQty === 0;
  const over = !unavailable && line.quantity > line.maxQty;
  return (
    <li className={cn("flex gap-4 py-5", pending && "opacity-60")}>
      <Link href={line.href} className="relative aspect-[4/5] w-24 shrink-0 overflow-hidden rounded-xl bg-sand">
        <Image src={line.image} alt="" fill sizes="96px" className="object-cover" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex justify-between gap-3">
          <div className="min-w-0">
            <Link href={line.href} className="text-[13px] uppercase tracking-[0.08em] hover:underline underline-offset-4">{line.name}</Link>
            <p className="text-[13px] text-muted-foreground">{line.label}</p>
          </div>
          <p className="shrink-0 text-sm">{formatMoney(line.unit * line.quantity, currency)}</p>
        </div>
        {unavailable && <p className="mt-1 text-xs text-destructive">No longer available. Remove it to check out.</p>}
        {over && <p className="mt-1 text-xs text-destructive">Only {line.maxQty} left. Reduce the quantity to check out.</p>}
        <div className="mt-auto flex items-center justify-between pt-3">
          {!unavailable ? (
            <div className="flex h-10 items-center rounded-full border border-foreground/20" role="group" aria-label={`Quantity for ${line.name}`}>
              <button type="button" aria-label="Decrease quantity" disabled={pending || line.quantity <= 1} onClick={() => set(line.quantity - 1)} className="flex size-10 items-center justify-center disabled:opacity-30"><MinusIcon width={14} /></button>
              <span className="w-6 text-center text-sm" aria-live="polite">{line.quantity}</span>
              <button type="button" aria-label="Increase quantity" disabled={pending || line.quantity >= line.maxQty} onClick={() => set(line.quantity + 1)} className="flex size-10 items-center justify-center disabled:opacity-30"><PlusIcon width={14} /></button>
            </div>
          ) : <span />}
          <button type="button" disabled={pending} onClick={() => set(0)} className="text-xs text-muted-foreground underline underline-offset-4">Remove</button>
        </div>
      </div>
    </li>
  );
}
