"use client";
import { useRouter } from "next/navigation";
import { SKIN_TYPES, SORTS } from "@/lib/constants";

const select = "h-10 rounded-full border border-foreground/20 bg-transparent px-4 text-[13px] outline-none focus:border-foreground";

export function SortSelect({ base, sort, skin, q }: { base: string; sort: string; skin?: string; q?: string }) {
  const router = useRouter();
  const go = (next: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries({ q, sort, skin, ...next })) if (v && !(k === "sort" && v === "featured")) params.set(k, v);
    router.push(params.size ? `${base}?${params}` : base, { scroll: false });
  };
  return (
    <div className="flex gap-2">
      <label className="sr-only" htmlFor="skin">Skin type</label>
      <select id="skin" className={select} value={skin ?? ""} onChange={(e) => go({ skin: e.target.value || undefined })}>
        <option value="">All skin types</option>
        {SKIN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      <label className="sr-only" htmlFor="sort">Sort by</label>
      <select id="sort" className={select} value={sort} onChange={(e) => go({ sort: e.target.value })}>
        {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
    </div>
  );
}
