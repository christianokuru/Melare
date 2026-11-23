"use client";
import { useState, useTransition } from "react";
import { unsubscribe } from "@/app/actions/store";
import { buttonPrimary } from "@/components/site/section";

export function UnsubscribeButton({ email, token }: { email: string; token: string }) {
  const [done, setDone] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (done) return <p role="status" className="mt-6 rounded-xl bg-blush p-4 text-sm">{done}</p>;
  return (
    <button type="button" disabled={pending} className={`${buttonPrimary} mt-6`}
      onClick={() => start(async () => { const r = await unsubscribe(email, token); setDone(r.ok ? "You’re unsubscribed. Sorry to see you go." : r.error); })}>
      {pending ? "Unsubscribing…" : "Unsubscribe"}
    </button>
  );
}
