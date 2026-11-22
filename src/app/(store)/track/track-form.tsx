"use client";
import { useSearchParams } from "next/navigation";
import { useState, useTransition } from "react";
import { lookupOrder } from "@/app/actions/account";
import { OrderView, type OrderViewData } from "@/components/order/order-view";
import { buttonPrimary, inputClass, labelClass } from "@/components/site/section";

export function TrackForm() {
  const initial = useSearchParams().get("number")?.slice(0, 12) ?? "";
  const [order, setOrder] = useState<OrderViewData | null>(null);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="grid gap-10">
      <form className="mx-auto grid w-full max-w-md gap-4" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        setError("");
        start(async () => {
          const r = await lookupOrder({ number: String(f.get("number")), email: String(f.get("email")) });
          if (r.ok) setOrder(r.order); else { setOrder(null); setError(r.error); }
        });
      }}>
        <div><label htmlFor="t-number" className={labelClass}>Order number</label><input id="t-number" name="number" defaultValue={initial} required placeholder="MLR-XXXXXXXX" className={`${inputClass} uppercase`} /></div>
        <div><label htmlFor="t-email" className={labelClass}>Email</label><input id="t-email" name="email" type="email" required autoComplete="email" className={inputClass} /></div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <button type="submit" disabled={pending} className={buttonPrimary}>{pending ? "Looking up…" : "Track order"}</button>
      </form>
      {order && <OrderView o={order} />}
    </div>
  );
}
