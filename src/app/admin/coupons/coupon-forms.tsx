"use client";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createCoupon, setCouponActive } from "@/app/actions/admin";
import { adminButton, adminInput, adminLabel } from "@/components/admin/ui";

const minor = (v: FormDataEntryValue | null) => (String(v ?? "").trim() ? Math.round(Number(v) * 100) : null);

export function CouponCreate() {
  const [kind, setKind] = useState<"percent" | "amount">("percent");
  const [pending, start] = useTransition();
  return (
    <form className="grid gap-3 rounded-2xl border bg-white p-4 sm:grid-cols-4 sm:items-end" onSubmit={(e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const f = new FormData(form);
      start(async () => {
        const r = await createCoupon({
          code: String(f.get("code")), kind, percentOff: kind === "percent" ? Number(f.get("percent")) : undefined,
          amountOffNgn: kind === "amount" ? minor(f.get("ngn")) ?? undefined : undefined, amountOffUsd: kind === "amount" ? minor(f.get("usd")) ?? undefined : undefined,
          minSubtotalNgn: minor(f.get("minNgn")), minSubtotalUsd: minor(f.get("minUsd")),
          maxRedemptions: f.get("max") ? Number(f.get("max")) : null, expiresAt: f.get("expires") ? new Date(String(f.get("expires"))) : null, ownerName: String(f.get("owner")),
        });
        if (r.ok) { toast.success("Coupon created"); form.reset(); } else toast.error(r.error);
      });
    }}>
      <div><label className={adminLabel}>Code</label><input name="code" required pattern="[A-Za-z0-9-]{3,32}" className={`${adminInput} uppercase`} /></div>
      <div><label className={adminLabel}>Type</label><select value={kind} onChange={(e) => setKind(e.target.value as "percent")} className={adminInput}><option value="percent">Percent off</option><option value="amount">Fixed amount</option></select></div>
      {kind === "percent" ? <div><label className={adminLabel}>Percent (1–90)</label><input name="percent" type="number" min={1} max={90} required className={adminInput} /></div> : (
        <><div><label className={adminLabel}>Amount ₦</label><input name="ngn" type="number" min={1} required className={adminInput} /></div><div><label className={adminLabel}>Amount $</label><input name="usd" type="number" min={1} required className={adminInput} /></div></>
      )}
      <div><label className={adminLabel}>Min. order ₦ (optional)</label><input name="minNgn" type="number" min={0} className={adminInput} /></div>
      <div><label className={adminLabel}>Min. order $ (optional)</label><input name="minUsd" type="number" min={0} className={adminInput} /></div>
      <div><label className={adminLabel}>Max uses (optional)</label><input name="max" type="number" min={1} className={adminInput} /></div>
      <div><label className={adminLabel}>Expires (optional)</label><input name="expires" type="date" className={adminInput} /></div>
      <div><label className={adminLabel}>Influencer / campaign</label><input name="owner" maxLength={60} className={adminInput} /></div>
      <button type="submit" disabled={pending} className={adminButton}>Create coupon</button>
    </form>
  );
}

export function CouponToggle({ id, active }: { id: string; active: boolean }) {
  const [pending, start] = useTransition();
  return <button type="button" disabled={pending} onClick={() => start(async () => { const r = await setCouponActive(id, !active); if (!r.ok) toast.error(r.error); })} className="text-xs underline">{active ? "Disable" : "Enable"}</button>;
}
