"use client";
import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { bulkUpdateOrders } from "@/app/actions/admin";
import { adminButton, adminGhost } from "@/components/admin/ui";

/** Wraps the orders table: row checkboxes (name="ids") + a header "select all" (data-select-all) + a sticky action bar. */
export function BulkOrders({ children }: { children: React.ReactNode }) {
  const form = useRef<HTMLFormElement>(null);
  const [count, setCount] = useState(0);
  const [pending, start] = useTransition();
  const boxes = () => [...(form.current?.querySelectorAll<HTMLInputElement>('input[name="ids"]') ?? [])];

  const run = (status: "processing" | "delivered") => start(async () => {
    const r = await bulkUpdateOrders(boxes().filter((b) => b.checked).map((b) => b.value), status);
    if (!r.ok) return void toast.error(r.error);
    toast.success(`${r.updated} order${r.updated === 1 ? "" : "s"} updated${r.skipped ? ` · ${r.skipped} skipped (their status doesn’t allow this)` : ""}`);
    form.current?.reset();
    setCount(0);
  });

  return (
    <form ref={form} onSubmit={(e) => e.preventDefault()} onChange={(e) => {
      const t = e.target as unknown as HTMLInputElement;
      if (t.dataset.selectAll !== undefined) boxes().forEach((b) => { b.checked = t.checked; });
      setCount(boxes().filter((b) => b.checked).length);
    }}>
      {children}
      {count > 0 && (
        <div className="sticky bottom-4 z-20 mt-4 flex flex-wrap items-center gap-2 rounded-2xl border bg-white p-3 shadow-lg" role="region" aria-label="Bulk actions">
          <span className="px-2 text-sm">{count} selected</span>
          <button type="button" disabled={pending} onClick={() => run("processing")} className={adminButton}>Mark preparing</button>
          <button type="button" disabled={pending} onClick={() => run("delivered")} className={adminGhost}>Mark delivered</button>
          <span className="text-xs text-muted-foreground">Shipping needs a tracking number, so do it per order.</span>
        </div>
      )}
    </form>
  );
}
