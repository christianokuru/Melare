"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { toastResult } from "@/lib/toast-result";
import { deleteCategory, saveCategory } from "@/app/actions/admin";
import { adminButton, adminInput, adminLabel } from "@/components/admin/ui";

type Cat = { id?: string; slug: string; name: string; description: string | null; image: string | null; position: number };

export function CategoryEditor({ categories }: { categories: Cat[] }) {
  const [pending, start] = useTransition();
  const rows: Cat[] = [...categories, { slug: "", name: "", description: "", image: "", position: categories.length + 1 }];
  return (
    <div className="grid gap-4">
      {rows.map((c) => (
        <form key={c.id ?? "new"} className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-6 sm:items-end" onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          start(async () => {
            const r = await saveCategory({ id: c.id, slug: String(f.get("slug")), name: String(f.get("name")), description: String(f.get("description")), image: String(f.get("image")), position: Number(f.get("position")) });
            if (r.ok) { toast.success("Saved"); if (!c.id) (e.target as HTMLFormElement).reset(); } else toast.error(r.error);
          });
        }}>
          <div><label className={adminLabel}>Name</label><input name="name" defaultValue={c.name} required className={adminInput} /></div>
          <div><label className={adminLabel}>Slug</label><input name="slug" defaultValue={c.slug} required className={adminInput} /></div>
          <div className="sm:col-span-2"><label className={adminLabel}>Description</label><input name="description" defaultValue={c.description ?? ""} className={adminInput} /></div>
          <div><label className={adminLabel}>Image path</label><input name="image" defaultValue={c.image ?? ""} placeholder="/images/…" className={adminInput} /></div>
          <div className="flex items-end gap-2">
            <div className="w-16"><label className={adminLabel}>Order</label><input name="position" type="number" min={0} defaultValue={c.position} className={adminInput} /></div>
            <button type="submit" disabled={pending} className={adminButton}>{c.id ? "Save" : "Add"}</button>
            {c.id && <button type="button" disabled={pending} onClick={() => confirm(`Delete ${c.name}? Products stay but lose this category.`) && start(async () => { const r = await deleteCategory(c.id!); toastResult(r, "Deleted"); })} className="h-10 text-xs text-destructive underline">Delete</button>}
          </div>
        </form>
      ))}
    </div>
  );
}
