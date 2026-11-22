"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { deleteAddress, saveAddress } from "@/app/actions/account";
import { COUNTRIES, NG_STATES } from "@/lib/constants";
import { buttonOutline, buttonPrimary, inputClass, labelClass } from "@/components/site/section";

type Address = { id: string; fullName: string; phone: string; line1: string; line2: string | null; city: string; state: string; country: string; postalCode: string | null; isDefault: boolean };
const EMPTY = { fullName: "", phone: "", line1: "", line2: "", city: "", state: "", country: "NG", postalCode: "", isDefault: false };

export function AddressBook({ addresses }: { addresses: Address[] }) {
  const [editing, setEditing] = useState<(typeof EMPTY & { id?: string }) | null>(null);
  const [pending, start] = useTransition();

  if (editing) {
    const set = (k: string, v: string | boolean) => setEditing({ ...editing, [k]: v });
    const input = (k: keyof typeof EMPTY, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
      <div><label htmlFor={`a-${k}`} className={labelClass}>{label}</label><input id={`a-${k}`} value={String(editing[k] ?? "")} onChange={(e) => set(k, e.target.value)} className={inputClass} {...props} /></div>
    );
    return (
      <form className="grid max-w-xl gap-4" onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          const r = await saveAddress(editing);
          if (r.ok) { toast.success("Address saved"); setEditing(null); } else toast.error(r.error);
        });
      }}>
        {input("fullName", "Full name", { required: true, autoComplete: "name" })}
        {input("phone", "Phone", { required: true, type: "tel", autoComplete: "tel" })}
        <div>
          <label htmlFor="a-country" className={labelClass}>Country</label>
          <select id="a-country" value={editing.country} onChange={(e) => setEditing({ ...editing, country: e.target.value, state: "" })} className={inputClass}>
            {Object.entries(COUNTRIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        {input("line1", "Address", { required: true, autoComplete: "address-line1" })}
        {input("line2", "Apartment, landmark (optional)")}
        <div className="grid grid-cols-2 gap-3">
          {input("city", "City / area", { required: true })}
          {editing.country === "NG" ? (
            <div>
              <label htmlFor="a-state" className={labelClass}>State</label>
              <select id="a-state" required value={editing.state} onChange={(e) => set("state", e.target.value)} className={inputClass}>
                <option value="">Select…</option>{NG_STATES.map((st) => <option key={st}>{st}</option>)}
              </select>
            </div>
          ) : input("state", "State / region", { required: true })}
        </div>
        {editing.country !== "NG" && input("postalCode", "Postal code")}
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.isDefault} onChange={(e) => set("isDefault", e.target.checked)} className="size-4 accent-foreground" /> Use as my default address</label>
        <div className="flex gap-3">
          <button type="submit" disabled={pending} className={buttonPrimary}>{pending ? "Saving…" : "Save address"}</button>
          <button type="button" onClick={() => setEditing(null)} className={buttonOutline}>Cancel</button>
        </div>
      </form>
    );
  }

  return (
    <div className="grid gap-6">
      {addresses.length === 0 && <p className="text-muted-foreground">No saved addresses yet. Save one for faster checkout.</p>}
      <ul className="grid gap-4 md:grid-cols-2">
        {addresses.map((a) => (
          <li key={a.id} className="rounded-2xl border p-5 text-sm">
            {a.isDefault && <span className="eyebrow mb-2 inline-block rounded-full bg-blush px-2.5 py-1 text-[10px]">Default</span>}
            <p className="font-medium">{a.fullName}</p>
            <p>{a.line1}{a.line2 ? `, ${a.line2}` : ""}</p>
            <p>{a.city}, {a.state}, {COUNTRIES[a.country] ?? a.country}</p>
            <p className="text-muted-foreground">{a.phone}</p>
            <div className="mt-4 flex gap-4 text-xs">
              <button type="button" className="underline underline-offset-4" onClick={() => setEditing({ ...EMPTY, ...a, line2: a.line2 ?? "", postalCode: a.postalCode ?? "" })}>Edit</button>
              <button type="button" disabled={pending} className="text-destructive underline underline-offset-4"
                onClick={() => confirm("Delete this address?") && start(async () => { const r = await deleteAddress(a.id); if (!r.ok) toast.error(r.error); })}>Delete</button>
            </div>
          </li>
        ))}
      </ul>
      {addresses.length < 10 && <button type="button" onClick={() => setEditing({ ...EMPTY })} className={`${buttonOutline} w-fit`}>Add address</button>}
    </div>
  );
}
