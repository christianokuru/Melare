"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { addToCart } from "@/app/actions/cart";
import { notifyWhenInStock } from "@/app/actions/store";
import { formatMoney, type Currency } from "@/lib/money";
import { track } from "@/lib/track";
import { cn } from "@/lib/utils";
import { MinusIcon, PlusIcon } from "@/components/site/icons";
import { buttonPrimary, inputClass } from "@/components/site/section";

type Variant = { id: string; label: string; price: number; compareAt: number | null; stock: number };

export function ProductBuy({ productId, name, variants, currency }: { productId: string; name: string; variants: Variant[]; currency: Currency }) {
  const [selected, setSelected] = useState(variants.find((v) => v.stock > 0) ?? variants[0]);
  const [qty, setQty] = useState(1);
  const [pending, start] = useTransition();
  const [showBar, setShowBar] = useState(false);
  const mainBtn = useRef<HTMLButtonElement>(null);
  const max = Math.min(10, selected.stock);
  const soldOut = selected.stock <= 0;

  useEffect(() => {
    track("view_item", currency, selected.price / 100, [{ item_id: productId, item_name: name, price: selected.price / 100 }]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productId]);

  useEffect(() => {
    const el = mainBtn.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setShowBar(!e.isIntersecting && e.boundingClientRect.top < 0));
    io.observe(el);
    return () => io.disconnect();
  }, [soldOut]);

  const add = () => start(async () => {
    const r = await addToCart({ variantId: selected.id, quantity: qty });
    if (r.ok) {
      toast.success(`${name} added to your bag`, { action: { label: "View bag", onClick: () => (window.location.href = "/cart") } });
      track("add_to_cart", currency, (selected.price * qty) / 100, [{ item_id: productId, item_name: name, price: selected.price / 100, quantity: qty }]);
    } else toast.error(r.error);
  });

  return (
    <div className="flex flex-col gap-5">
      <p className="flex items-baseline gap-3 text-2xl">
        {formatMoney(selected.price, currency)}
        {selected.compareAt && selected.compareAt > selected.price && <s className="text-base text-muted-foreground">{formatMoney(selected.compareAt, currency)}</s>}
      </p>

      {variants.length > 1 && (
        <fieldset>
          <legend className="eyebrow mb-2 text-muted-foreground">Size</legend>
          <div className="flex flex-wrap gap-2">
            {variants.map((v) => (
              <button key={v.id} type="button" aria-pressed={v.id === selected.id} onClick={() => { setSelected(v); setQty(1); }}
                className={cn("h-11 min-w-20 rounded-full border px-5 text-sm transition-colors", v.id === selected.id ? "border-foreground bg-foreground text-background" : "border-foreground/25", v.stock <= 0 && "line-through opacity-60")}>
                {v.label}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {!soldOut && selected.stock <= 5 && <p className="text-sm text-[#9a5b2e]">Only {selected.stock} left. Order soon.</p>}

      {soldOut ? <NotifyMe variantId={selected.id} /> : (
        <div className="flex gap-3">
          <div className="flex h-12 items-center rounded-full border border-foreground/25" role="group" aria-label="Quantity">
            <button type="button" aria-label="Decrease quantity" disabled={qty <= 1} onClick={() => setQty((q) => q - 1)} className="flex size-12 items-center justify-center disabled:opacity-30"><MinusIcon width={16} /></button>
            <output aria-live="polite" className="w-6 text-center">{qty}</output>
            <button type="button" aria-label="Increase quantity" disabled={qty >= max} onClick={() => setQty((q) => q + 1)} className="flex size-12 items-center justify-center disabled:opacity-30"><PlusIcon width={16} /></button>
          </div>
          <button ref={mainBtn} type="button" onClick={add} disabled={pending} className={cn(buttonPrimary, "flex-1")}>
            {pending ? "Adding…" : `Add to bag · ${formatMoney(selected.price * qty, currency)}`}
          </button>
        </div>
      )}

      {/* Sticky mobile add-to-bag */}
      {!soldOut && (
        <div className={cn("fixed inset-x-0 bottom-0 z-40 flex items-center gap-3 border-t bg-background/95 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur transition-transform lg:hidden", showBar ? "translate-y-0" : "translate-y-full")}
          aria-hidden={!showBar}>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">{name}</p>
            <p className="text-xs text-muted-foreground">{selected.label} · {formatMoney(selected.price, currency)}</p>
          </div>
          <button type="button" tabIndex={showBar ? 0 : -1} onClick={add} disabled={pending} className={cn(buttonPrimary, "h-11 px-6")}>{pending ? "Adding…" : "Add to bag"}</button>
        </div>
      )}
    </div>
  );
}

function NotifyMe({ variantId }: { variantId: string }) {
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();
  if (done) return <p className="rounded-xl bg-blush p-4 text-sm">We’ll email you the moment it’s back in stock.</p>;
  return (
    <form className="flex flex-col gap-3" onSubmit={(e) => {
      e.preventDefault();
      const email = String(new FormData(e.currentTarget).get("email") ?? "");
      start(async () => { const r = await notifyWhenInStock(email, variantId); if (r.ok) setDone(true); else toast.error(r.error); });
    }}>
      <p className="text-sm">Sold out. Leave your email and we’ll let you know when it’s back.</p>
      <label htmlFor="notify-email" className="sr-only">Email</label>
      <input id="notify-email" name="email" type="email" required placeholder="Email address" className={inputClass} />
      <button type="submit" disabled={pending} className={buttonPrimary}>{pending ? "Saving…" : "Notify me"}</button>
    </form>
  );
}
