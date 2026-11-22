"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { toastResult } from "@/lib/toast-result";
import { archiveProduct, duplicateProduct, saveProduct } from "@/app/actions/admin";
import { useConfirm } from "@/components/use-confirm";
import { CONCERNS, SKIN_TYPES } from "@/lib/constants";
import { slugify } from "@/lib/utils";
import { adminButton, adminGhost, adminInput, adminLabel } from "@/components/admin/ui";
import { ImageUpload } from "@/components/admin/image-upload";

type V = { id?: string; sku: string; label: string; priceNgn: number; priceUsd: number; compareAtNgn: number | null; compareAtUsd: number | null; stock: number };
type Img = { src: string; alt: string };
type Product = {
  id: string; slug: string; name: string; tagline: string; description: string; benefits: string[]; ingredients: string | null; howToUse: string | null;
  skinTypes: string[]; concerns: string[]; categoryId: string | null; status: "draft" | "active" | "archived"; featured: boolean; daysSupply: number | null;
  seoTitle: string | null; seoDescription: string | null; variants: V[]; images: Img[];
};

const toMajor = (m: number | null) => (m == null ? "" : String(m / 100));
const toMinor = (v: string) => (v.trim() === "" ? null : Math.round(Number(v) * 100));

export function ProductForm({ categories, product }: { categories: { id: string; name: string }[]; product?: Product }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [skin, setSkin] = useState<string[]>(product?.skinTypes ?? []);
  const [concerns, setConcerns] = useState<string[]>(product?.concerns ?? []);
  const [variants, setVariants] = useState<(Omit<V, "priceNgn" | "priceUsd" | "compareAtNgn" | "compareAtUsd" | "stock"> & Record<"priceNgn" | "priceUsd" | "compareAtNgn" | "compareAtUsd" | "stock", string>)[]>(
    (product?.variants ?? [{ sku: "", label: "", priceNgn: 0, priceUsd: 0, compareAtNgn: null, compareAtUsd: null, stock: 0 }]).map((v) => ({
      id: v.id, sku: v.sku, label: v.label, priceNgn: v.priceNgn ? toMajor(v.priceNgn) : "", priceUsd: v.priceUsd ? toMajor(v.priceUsd) : "",
      compareAtNgn: toMajor(v.compareAtNgn), compareAtUsd: toMajor(v.compareAtUsd), stock: String(v.stock),
    })));
  const [images, setImages] = useState<Img[]>(product?.images.map(({ src, alt }) => ({ src, alt })) ?? [{ src: "", alt: "" }]);
  const [dragging, setDragging] = useState<number | null>(null);
  const [confirm, confirmDialog] = useConfirm();
  const toggle = (list: string[], set: (v: string[]) => void, v: string) => set(list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const moveImage = (from: number, to: number) => {
    if (to < 0 || to >= images.length || from === to) return;
    const next = [...images];
    next.splice(to, 0, next.splice(from, 1)[0]);
    setImages(next);
  };

  return (
    <form className="grid max-w-4xl gap-8" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      const str = (k: string) => String(f.get(k) ?? "");
      start(async () => {
        const r = await saveProduct({
          id: product?.id, slug, name: str("name"), tagline: str("tagline"), description: str("description"),
          benefits: str("benefits").split("\n").map((b) => b.trim()).filter(Boolean),
          ingredients: str("ingredients"), howToUse: str("howToUse"), skinTypes: skin as never, concerns: concerns as never,
          categoryId: str("categoryId") || null, status: str("status") as Product["status"], featured: f.get("featured") === "on",
          daysSupply: str("daysSupply") ? Number(str("daysSupply")) : null, seoTitle: str("seoTitle"), seoDescription: str("seoDescription"),
          variants: variants.map((v) => ({ id: v.id, sku: v.sku.toUpperCase(), label: v.label, priceNgn: toMinor(v.priceNgn) ?? 0, priceUsd: toMinor(v.priceUsd) ?? 0,
            compareAtNgn: toMinor(v.compareAtNgn), compareAtUsd: toMinor(v.compareAtUsd), stock: Number(v.stock || 0) })),
          images,
        });
        if (r.ok) { toast.success("Product saved"); if (!product && r.id) router.replace(`/admin/products/${r.id}`); }
        else toast.error(r.error);
      });
    }}>
      <h1 className="font-heading text-4xl">{product ? product.name : "New product"}</h1>
      <section className="grid gap-4 sm:grid-cols-2">
        <div><label className={adminLabel} htmlFor="p-name">Name</label><input id="p-name" name="name" required defaultValue={product?.name} className={adminInput} onBlur={(e) => !product && !slug && setSlug(slugify(e.target.value))} /></div>
        <div><label className={adminLabel} htmlFor="p-slug">URL slug</label><input id="p-slug" value={slug} onChange={(e) => setSlug(e.target.value)} required pattern="[a-z0-9]+(-[a-z0-9]+)*" className={adminInput} /></div>
        <div className="sm:col-span-2"><label className={adminLabel} htmlFor="p-tag">Tagline</label><input id="p-tag" name="tagline" required maxLength={140} defaultValue={product?.tagline} className={adminInput} /></div>
        <div className="sm:col-span-2"><label className={adminLabel} htmlFor="p-desc">Description</label><textarea id="p-desc" name="description" required rows={4} defaultValue={product?.description} className={`${adminInput} h-auto py-2`} /></div>
        <div className="sm:col-span-2"><label className={adminLabel} htmlFor="p-ben">Benefits (one per line)</label><textarea id="p-ben" name="benefits" rows={4} defaultValue={product?.benefits.join("\n")} className={`${adminInput} h-auto py-2`} /></div>
        <div><label className={adminLabel} htmlFor="p-ing">Ingredients</label><textarea id="p-ing" name="ingredients" rows={4} defaultValue={product?.ingredients ?? ""} className={`${adminInput} h-auto py-2`} /></div>
        <div><label className={adminLabel} htmlFor="p-how">How to use</label><textarea id="p-how" name="howToUse" rows={4} defaultValue={product?.howToUse ?? ""} className={`${adminInput} h-auto py-2`} /></div>
        <div><label className={adminLabel} htmlFor="p-cat">Category</label>
          <select id="p-cat" name="categoryId" defaultValue={product?.categoryId ?? ""} className={adminInput}><option value="">None</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <div><label className={adminLabel} htmlFor="p-status">Status</label>
          <select id="p-status" name="status" defaultValue={product?.status ?? "draft"} className={adminInput}><option value="draft">Draft (hidden)</option><option value="active">Active (live)</option><option value="archived">Archived</option></select></div>
        <div><label className={adminLabel} htmlFor="p-days">Days supply (for reorder reminders)</label><input id="p-days" name="daysSupply" type="number" min={7} max={365} defaultValue={product?.daysSupply ?? ""} className={adminInput} /></div>
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="featured" defaultChecked={product?.featured} className="accent-foreground" /> Featured (bestseller badge)</label>
      </section>

      <fieldset><legend className={adminLabel}>Skin types</legend><div className="flex flex-wrap gap-3">{SKIN_TYPES.map((t) => <label key={t} className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={skin.includes(t)} onChange={() => toggle(skin, setSkin, t)} className="accent-foreground" />{t}</label>)}</div></fieldset>
      <fieldset><legend className={adminLabel}>Concerns</legend><div className="flex flex-wrap gap-3">{CONCERNS.map((c) => <label key={c.slug} className="flex items-center gap-1.5 text-sm"><input type="checkbox" checked={concerns.includes(c.slug)} onChange={() => toggle(concerns, setConcerns, c.slug)} className="accent-foreground" />{c.name}</label>)}</div></fieldset>

      <section>
        <h2 className="mb-3 font-heading text-2xl">Sizes, prices & stock</h2>
        <p className="mb-3 text-xs text-muted-foreground">Enter prices in naira and dollars (e.g. 28500 and 32).</p>
        <div className="grid gap-3">
          {variants.map((v, i) => {
            const set = (k: string, val: string) => setVariants(variants.map((x, j) => (j === i ? { ...x, [k]: val } : x)));
            return (
              <div key={i} className="grid grid-cols-2 gap-2 rounded-xl border bg-white p-3 sm:grid-cols-4 lg:grid-cols-8">
                {([["sku", "SKU"], ["label", "Size"], ["priceNgn", "Price ₦"], ["priceUsd", "Price $"], ["compareAtNgn", "Was ₦"], ["compareAtUsd", "Was $"], ["stock", "Stock"]] as const).map(([k, label]) => (
                  <div key={k}><label className={adminLabel} htmlFor={`v${i}-${k}`}>{label}</label><input id={`v${i}-${k}`} value={v[k]} onChange={(e) => set(k, e.target.value)} required={!k.startsWith("compare")} inputMode={k === "sku" || k === "label" ? "text" : "decimal"} className={adminInput} /></div>
                ))}
                <button type="button" disabled={variants.length === 1} onClick={() => setVariants(variants.filter((_, j) => j !== i))} className="self-end pb-2 text-xs text-destructive underline disabled:opacity-30">Remove</button>
              </div>
            );
          })}
        </div>
        <button type="button" onClick={() => setVariants([...variants, { sku: "", label: "", priceNgn: "", priceUsd: "", compareAtNgn: "", compareAtUsd: "", stock: "0" }])} className={`${adminGhost} mt-3`}>Add size</button>
      </section>

      <section>
        <h2 className="mb-3 font-heading text-2xl">Images</h2>
        <p className="mb-3 text-xs text-muted-foreground">JPG, PNG, WebP or AVIF up to 4 MB, at least 400px wide. Images are resized and converted to WebP automatically. Drag to reorder (or use the arrows); the first image is the main photo.</p>
        <div className="grid gap-3">
          {images.map((im, i) => (
            <div key={i} draggable onDragStart={() => setDragging(i)} onDragEnd={() => setDragging(null)}
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (dragging != null) moveImage(dragging, i); setDragging(null); }}
              className={`grid gap-3 rounded-xl border bg-white p-3 sm:grid-cols-[auto_auto_1fr_auto] sm:items-end ${dragging === i ? "opacity-50" : ""}`}>
              <div className="flex items-center gap-1 sm:flex-col" aria-label={`Image ${i + 1} position`}>
                <span className="cursor-grab px-1 text-muted-foreground select-none" aria-hidden title="Drag to reorder">⠿</span>
                <button type="button" disabled={i === 0} onClick={() => moveImage(i, i - 1)} aria-label="Move image up" className="rounded px-1.5 text-sm disabled:opacity-30">↑</button>
                <button type="button" disabled={i === images.length - 1} onClick={() => moveImage(i, i + 1)} aria-label="Move image down" className="rounded px-1.5 text-sm disabled:opacity-30">↓</button>
                {i === 0 && <span className="text-[10px] uppercase tracking-[0.08em] text-muted-foreground sm:hidden">Main</span>}
              </div>
              <ImageUpload folder="products" value={im.src} onChange={(src) => setImages(images.map((x, j) => (j === i ? { ...x, src } : x)))} />
              <div><label className={adminLabel} htmlFor={`i${i}-alt`}>Alt text (describe the photo)</label><input id={`i${i}-alt`} value={im.alt} onChange={(e) => setImages(images.map((x, j) => (j === i ? { ...x, alt: e.target.value } : x)))} required className={adminInput} /></div>
              <button type="button" disabled={images.length === 1} onClick={() => setImages(images.filter((_, j) => j !== i))} className="pb-2 text-xs text-destructive underline disabled:opacity-30">Remove</button>
            </div>
          ))}
        </div>
        {images.length < 8 && <button type="button" onClick={() => setImages([...images, { src: "", alt: "" }])} className={`${adminGhost} mt-3`}>Add image</button>}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <h2 className="font-heading text-2xl sm:col-span-2">SEO (optional)</h2>
        <div><label className={adminLabel} htmlFor="p-st">SEO title (≤70)</label><input id="p-st" name="seoTitle" maxLength={70} defaultValue={product?.seoTitle ?? ""} className={adminInput} /></div>
        <div><label className={adminLabel} htmlFor="p-sd">Meta description (≤160)</label><input id="p-sd" name="seoDescription" maxLength={160} defaultValue={product?.seoDescription ?? ""} className={adminInput} /></div>
      </section>

      <div className="flex flex-wrap gap-3">
        <button type="submit" disabled={pending} className={adminButton}>{pending ? "Saving…" : "Save product"}</button>
        {product && (
          <button type="button" disabled={pending} className={adminGhost} onClick={() => start(async () => {
            const r = await duplicateProduct(product.id);
            if (toastResult(r, "Copy created as a draft") && r.ok && r.id) router.push(`/admin/products/${r.id}`);
          })}>Duplicate</button>
        )}
        {product && product.status !== "archived" && (
          <button type="button" disabled={pending} className={adminGhost} onClick={async () => {
            if (await confirm("Archive this product? It will be hidden from the store.", "Archive")) start(async () => { toastResult(await archiveProduct(product.id), "Archived"); });
          }}>Archive</button>
        )}
      </div>
      {confirmDialog}
    </form>
  );
}
