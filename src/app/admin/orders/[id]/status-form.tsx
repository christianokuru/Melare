"use client";
import { useState, useTransition } from "react";
import { toastResult } from "@/lib/toast-result";
import { updateOrder } from "@/app/actions/admin";
import { STATUS_LABEL } from "@/components/order/order-view";
import { adminButton, adminInput, adminLabel } from "@/components/admin/ui";

const NEXT: Record<string, string[]> = {
  pending: ["cancelled"], paid: ["processing", "shipped", "cancelled", "refunded"], processing: ["shipped", "cancelled", "refunded"],
  shipped: ["delivered", "refunded"], delivered: ["refunded"], cancelled: [], refunded: [],
};

export function OrderStatusForm({ id, status, trackingNumber, note }: { id: string; status: string; trackingNumber: string; note: string }) {
  const [next, setNext] = useState(status);
  const [restock, setRestock] = useState(true);
  const [pending, start] = useTransition();
  return (
    <form className="h-fit rounded-2xl border bg-white p-5 xl:sticky xl:top-6" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      if ((next === "cancelled" || next === "refunded") && !confirm(`Mark this order as ${next}? Remember to refund the payment in Flutterwave.`)) return;
      start(async () => {
        const r = await updateOrder({ id, status: next as "paid", trackingNumber: String(f.get("tracking")), note: String(f.get("note")), restock });
        toastResult(r, "Order updated");
      });
    }}>
      <h2 className="mb-4 font-heading text-2xl">Update order</h2>
      <label htmlFor="o-status" className={adminLabel}>Status</label>
      <select id="o-status" value={next} onChange={(e) => setNext(e.target.value)} className={adminInput}>
        <option value={status}>{STATUS_LABEL[status]} (current)</option>
        {NEXT[status].map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
      </select>
      {next === "refunded" && (
        <label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={restock} onChange={(e) => setRestock(e.target.checked)} className="accent-foreground" /> Return items to stock</label>
      )}
      <label htmlFor="o-track" className={`${adminLabel} mt-4`}>Tracking number {next === "shipped" && "(required)"}</label>
      <input id="o-track" name="tracking" defaultValue={trackingNumber} maxLength={80} className={adminInput} />
      <label htmlFor="o-note" className={`${adminLabel} mt-4`}>Internal note</label>
      <textarea id="o-note" name="note" defaultValue={note} maxLength={500} rows={3} className={`${adminInput} h-auto py-2`} />
      <button type="submit" disabled={pending} className={`${adminButton} mt-4 w-full`}>{pending ? "Saving…" : "Save"}</button>
      <p className="mt-3 text-xs text-muted-foreground">Customers are emailed when an order is shipped, delivered, cancelled or refunded. Refunds must be issued in your Flutterwave dashboard.</p>
    </form>
  );
}
