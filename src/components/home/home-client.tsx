"use client";
import Link from "next/link";
import { useId, useState } from "react";
import { PlusIcon } from "@/components/site/icons";
import { useAddToBag } from "@/components/product/use-add-to-bag";
import { cn } from "@/lib/utils";

/** Accessible tabs: content is server-rendered for every tab, only visibility switches. */
export function HomeTabs({ tabs }: { tabs: { label: string; content: React.ReactNode }[] }) {
  const [active, setActive] = useState(0);
  const id = useId();
  return (
    <div>
      <div role="tablist" aria-label="Featured products" className="no-scrollbar -mx-4 mb-6 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0"
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          const next = (active + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length;
          setActive(next);
          document.getElementById(`${id}-tab-${next}`)?.focus();
        }}>
        {tabs.map((t, i) => (
          <button key={t.label} id={`${id}-tab-${i}`} type="button" role="tab" aria-selected={i === active} aria-controls={`${id}-panel-${i}`} tabIndex={i === active ? 0 : -1}
            onClick={() => setActive(i)} className={cn("eyebrow shrink-0 rounded-full border px-4 py-2.5 transition-colors", i === active ? "border-foreground bg-foreground text-background" : "border-foreground/20 hover:border-foreground")}>
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t, i) => (
        <div key={t.label} id={`${id}-panel-${i}`} role="tabpanel" aria-labelledby={`${id}-tab-${i}`} hidden={i !== active}>{t.content}</div>
      ))}
    </div>
  );
}

/** Round "+" for the hero's floating product card. */
export function HeroAdd({ variantId, name, slug, multiple }: { variantId: string; name: string; slug: string; multiple: boolean }) {
  const { add, pending } = useAddToBag();
  const cls = "flex size-10 shrink-0 items-center justify-center rounded-full bg-foreground text-background transition-opacity hover:opacity-90 disabled:opacity-50";
  if (multiple) return <Link href={`/products/${slug}`} aria-label={`Choose a size of ${name}`} className={cls}><PlusIcon width={18} /></Link>;
  return (
    <button type="button" disabled={pending} aria-label={`Add ${name} to bag`} className={cls} onClick={() => add({ variantId, quantity: 1 }, `${name} added to your bag`)}>
      <PlusIcon width={18} />
    </button>
  );
}
