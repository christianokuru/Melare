"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { setVariantStock } from "@/app/actions/admin";

/** Per-variant stock, saved on blur/Enter. Restocking from 0 notifies "back in stock" subscribers (server side). */
export function StockEditor({ variants }: { variants: { id: string; label: string; stock: number }[] }) {
  return <div className="grid gap-1.5">{variants.map((v) => <StockInput key={v.id} {...v} />)}</div>;
}

function StockInput({ id, label, stock }: { id: string; label: string; stock: number }) {
  const [value, setValue] = useState(String(stock));
  const [saved, setSaved] = useState(stock);
  const [pending, start] = useTransition();
  const save = () => {
    const n = Number(value);
    if (value === String(saved)) return;
    if (!Number.isInteger(n) || n < 0) { setValue(String(saved)); return void toast.error("Stock must be a whole number from 0."); }
    start(async () => {
      const r = await setVariantStock(id, n);
      if (r.ok) { setSaved(n); toast.success(`${label}: stock ${n}`); } else { setValue(String(saved)); toast.error(r.error); }
    });
  };
  return (
    <label className="flex items-center justify-end gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <input type="number" min={0} inputMode="numeric" value={value} disabled={pending} onChange={(e) => setValue(e.target.value)} onBlur={save}
        onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), e.currentTarget.blur())}
        className={`h-8 w-20 rounded-md border bg-white px-2 text-right text-sm outline-none focus:border-foreground ${saved <= 5 ? "border-destructive/50 text-destructive" : ""}`} />
    </label>
  );
}
