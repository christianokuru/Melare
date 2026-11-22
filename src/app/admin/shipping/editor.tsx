"use client";
import { useTransition } from "react";
import { toastResult } from "@/lib/toast-result";
import { deleteZone, saveZone } from "@/app/actions/admin";
import { adminButton, adminInput, adminLabel } from "@/components/admin/ui";

type Zone = { id?: string; name: string; country: string; state: string | null; feeNgn: number; feeUsd: number; freeOverNgn: number | null; freeOverUsd: number | null; eta: string; position: number };
const major = (m: number | null) => (m == null ? "" : m / 100);
const minor = (v: FormDataEntryValue | null) => (String(v ?? "").trim() === "" ? null : Math.round(Number(v) * 100));

export function ZoneEditor({ zones }: { zones: Zone[] }) {
  const [pending, start] = useTransition();
  const rows: Zone[] = [...zones, { name: "", country: "", state: "", feeNgn: 0, feeUsd: 0, freeOverNgn: null, freeOverUsd: null, eta: "", position: zones.length + 1 }];
  return (
    <div className="grid gap-3">
      {rows.map((z) => (
        <form key={z.id ?? "new"} className="grid grid-cols-2 gap-2 rounded-2xl border bg-white p-4 sm:grid-cols-5 lg:grid-cols-10 lg:items-end" onSubmit={(e) => {
          e.preventDefault();
          const f = new FormData(e.currentTarget);
          start(async () => {
            const r = await saveZone({ id: z.id, name: String(f.get("name")), country: String(f.get("country")), state: String(f.get("state")), feeNgn: minor(f.get("feeNgn")) ?? 0, feeUsd: minor(f.get("feeUsd")) ?? 0,
              freeOverNgn: minor(f.get("freeNgn")), freeOverUsd: minor(f.get("freeUsd")), eta: String(f.get("eta")), position: Number(f.get("position")) });
            toastResult(r, "Saved");
          });
        }}>
          {([["name", "Name", z.name], ["country", "Country (NG / *)", z.country], ["state", "State (opt.)", z.state ?? ""], ["feeNgn", "Fee ₦", major(z.feeNgn)], ["feeUsd", "Fee $", major(z.feeUsd)],
            ["freeNgn", "Free over ₦", major(z.freeOverNgn)], ["freeUsd", "Free over $", major(z.freeOverUsd)], ["eta", "Delivery time", z.eta], ["position", "Order", z.position]] as const).map(([k, label, v]) => (
            <div key={k}><label className={adminLabel}>{label}</label><input name={k} defaultValue={String(v)} required={["name", "country", "feeNgn", "feeUsd", "eta"].includes(k)} className={adminInput} /></div>
          ))}
          <div className="flex items-end gap-2">
            <button type="submit" disabled={pending} className={adminButton}>{z.id ? "Save" : "Add"}</button>
            {z.id && <button type="button" disabled={pending} onClick={() => confirm(`Delete ${z.name}?`) && start(async () => { const r = await deleteZone(z.id!); toastResult(r, "Deleted"); })} className="h-10 text-xs text-destructive underline">Delete</button>}
          </div>
        </form>
      ))}
    </div>
  );
}
