"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { toastResult } from "@/lib/toast-result";
import { deleteBundle, saveBundle } from "@/app/actions/admin";
import { adminButton, adminGhost, adminInput, adminLabel } from "@/components/admin/ui";
import { ImageUpload } from "@/components/admin/image-upload";

type Bundle = { id?: string; slug: string; name: string; tagline: string; description: string; image: string; discountPercent: number; active: boolean; items: { variantId: string; quantity: number }[] };
const EMPTY: Bundle = { slug: "", name: "", tagline: "", description: "", image: "", discountPercent: 10, active: true, items: [] };

export function BundleEditor({ bundles, variants }: { bundles: Bundle[]; variants: { id: string; label: string }[] }) {
  const [editing, setEditing] = useState<Bundle | null>(null);
  const [pending, start] = useTransition();
  if (editing) {
    const set = (k: keyof Bundle, v: unknown) => setEditing({ ...editing, [k]: v });
    return (
      <form className="grid max-w-3xl gap-4" onSubmit={(e) => { e.preventDefault(); start(async () => { const r = await saveBundle(editing); if (r.ok) { toast.success("Bundle saved"); setEditing(null); } else toast.error(r.error); }); }}>
        <div className="grid gap-3 sm:grid-cols-2">
          <div><label className={adminLabel}>Name</label><input value={editing.name} onChange={(e) => set("name", e.target.value)} required className={adminInput} /></div>
          <div><label className={adminLabel}>Slug</label><input value={editing.slug} onChange={(e) => set("slug", e.target.value)} required className={adminInput} /></div>
          <div className="sm:col-span-2"><label className={adminLabel}>Tagline</label><input value={editing.tagline} onChange={(e) => set("tagline", e.target.value)} required className={adminInput} /></div>
          <div className="sm:col-span-2"><label className={adminLabel}>Description</label><textarea value={editing.description} onChange={(e) => set("description", e.target.value)} rows={3} required className={`${adminInput} h-auto py-2`} /></div>
          <div><span className={adminLabel}>Image</span><ImageUpload folder="bundles" value={editing.image} onChange={(url) => set("image", url)} /></div>
          <div><label className={adminLabel}>Discount %</label><input type="number" min={1} max={50} value={editing.discountPercent} onChange={(e) => set("discountPercent", Number(e.target.value))} className={adminInput} /></div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.active} onChange={(e) => set("active", e.target.checked)} className="accent-foreground" /> Active</label>
        </div>
        <fieldset className="grid gap-2">
          <legend className={adminLabel}>Products in this bundle (at least 2)</legend>
          {editing.items.map((it, i) => (
            <div key={i} className="flex gap-2">
              <select value={it.variantId} onChange={(e) => set("items", editing.items.map((x, j) => (j === i ? { ...x, variantId: e.target.value } : x)))} className={adminInput}>
                {variants.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
              </select>
              <input type="number" min={1} max={5} value={it.quantity} aria-label="Quantity" onChange={(e) => set("items", editing.items.map((x, j) => (j === i ? { ...x, quantity: Number(e.target.value) } : x)))} className={`${adminInput} w-20`} />
              <button type="button" onClick={() => set("items", editing.items.filter((_, j) => j !== i))} className="text-xs text-destructive underline">Remove</button>
            </div>
          ))}
          <button type="button" onClick={() => set("items", [...editing.items, { variantId: variants[0]?.id, quantity: 1 }])} className={`${adminGhost} w-fit`}>Add product</button>
        </fieldset>
        <div className="flex gap-3"><button type="submit" disabled={pending} className={adminButton}>Save bundle</button><button type="button" onClick={() => setEditing(null)} className={adminGhost}>Cancel</button></div>
      </form>
    );
  }
  return (
    <div className="grid gap-3">
      {bundles.map((b) => (
        <div key={b.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white p-4">
          <div><p className="font-medium">{b.name} {!b.active && <span className="text-xs text-muted-foreground">(inactive)</span>}</p><p className="text-xs text-muted-foreground">{b.items.length} products · {b.discountPercent}% off · /bundles/{b.slug}</p></div>
          <div className="flex gap-3 text-xs">
            <button type="button" onClick={() => setEditing(b)} className="underline">Edit</button>
            <button type="button" disabled={pending} onClick={() => confirm(`Delete ${b.name}?`) && start(async () => { const r = await deleteBundle(b.id!); toastResult(r, "Deleted"); })} className="text-destructive underline">Delete</button>
          </div>
        </div>
      ))}
      <button type="button" onClick={() => setEditing({ ...EMPTY })} className={`${adminButton} w-fit`}>New bundle</button>
    </div>
  );
}
