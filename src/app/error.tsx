"use client";
import Link from "next/link";
import { buttonOutline, buttonPrimary } from "@/components/site/section";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <h1 className="font-heading text-[40px] leading-none">Something went wrong</h1>
      <p className="max-w-md text-muted-foreground">Please try again. If it keeps happening, chat with us on WhatsApp and we’ll help.</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row"><button type="button" onClick={reset} className={buttonPrimary}>Try again</button><Link href="/" className={buttonOutline}>Home</Link></div>
    </main>
  );
}
