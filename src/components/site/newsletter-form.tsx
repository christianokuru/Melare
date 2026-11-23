"use client";
import { useState, useTransition } from "react";
import { subscribe } from "@/app/actions/store";

export function NewsletterForm({ source = "footer" }: { source?: string }) {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  return (
    <form className="w-full max-w-md" onSubmit={(e) => {
      e.preventDefault();
      const form = e.currentTarget;
      const email = String(new FormData(form).get("email") ?? "");
      start(async () => {
        const r = await subscribe(email);
        setMsg(r.ok ? { ok: true, text: "Almost there: tap the link we just emailed you to confirm and get 10% off." } : { ok: false, text: r.error });
        if (r.ok) form.reset();
      });
    }}>
      <div className="flex items-center border-b border-foreground">
        <label htmlFor={`nl-${source}`} className="sr-only">Email address</label>
        <input id={`nl-${source}`} name="email" type="email" required autoComplete="email" placeholder="Email address" className="h-12 min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground" />
        <button type="submit" disabled={pending} className="eyebrow h-12 pl-4 disabled:opacity-50">{pending ? "Joining…" : "Join"}</button>
      </div>
      <p role="status" className={`mt-2 min-h-5 text-xs ${msg?.ok === false ? "text-destructive" : "text-muted-foreground"}`}>{msg?.text}</p>
    </form>
  );
}
