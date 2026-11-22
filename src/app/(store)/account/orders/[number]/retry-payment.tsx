"use client";
import { useState, useTransition } from "react";
import { retryPayment } from "@/app/actions/checkout";
import { buttonPrimary } from "@/components/site/section";

export function RetryPayment({ number }: { number: string }) {
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return (
    <div className="mb-8 rounded-2xl bg-[#f6ead2] p-5 text-sm">
      <p>This order is awaiting payment. Your items are reserved for a short time.</p>
      {error && <p role="alert" className="mt-2 text-destructive">{error}</p>}
      <button type="button" disabled={pending} className={`${buttonPrimary} mt-4`} onClick={() => start(async () => { const r = await retryPayment(number); if (r?.error) setError(r.error); })}>
        {pending ? "Connecting…" : "Complete payment"}
      </button>
    </div>
  );
}
