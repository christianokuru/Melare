"use client";
import Link from "next/link";
import { setConsent, useConsent } from "@/lib/consent";
import { analyticsEnabled } from "./analytics";

export function CookieBanner() {
  const consent = useConsent();
  if (!analyticsEnabled || consent !== null) return null; // undecided only (undefined = not yet hydrated)
  return (
    <div role="dialog" aria-live="polite" aria-label="Cookie preferences"
      className="fixed inset-x-3 bottom-[calc(0.75rem+env(safe-area-inset-bottom))] z-50 mx-auto max-w-xl rounded-2xl border bg-background p-5 shadow-xl shadow-foreground/10 sm:inset-x-6">
      <p className="font-heading text-xl">A little cookie, gently used</p>
      <p className="mt-1 text-sm text-muted-foreground">
        We use analytics cookies to understand how our site is used and improve your experience. Essential cookies (your bag and sign-in) are always on. <Link href="/privacy" className="underline underline-offset-4">Privacy policy</Link>
      </p>
      <div className="mt-4 flex gap-3">
        <button type="button" onClick={() => setConsent("granted")} className="h-11 flex-1 rounded-full bg-foreground text-[12px] uppercase tracking-[0.14em] text-background">Accept</button>
        <button type="button" onClick={() => setConsent("denied")} className="h-11 flex-1 rounded-full border border-foreground text-[12px] uppercase tracking-[0.14em]">Decline</button>
      </div>
    </div>
  );
}

/** Footer link that re-opens the banner. */
export function CookieSettingsLink({ className }: { className?: string }) {
  if (!analyticsEnabled) return null;
  return <button type="button" onClick={() => setConsent(null)} className={className}>Cookie settings</button>;
}
