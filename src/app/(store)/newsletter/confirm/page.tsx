import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { verifyEmailToken } from "@/lib/email-tokens";
import { sendEmail, unsuppress } from "@/lib/email";
import { ScrubUrl } from "@/components/scrub-url";
import { buttonPrimary } from "@/components/site/section";

export const metadata: Metadata = { title: "Confirm subscription", robots: { index: false, follow: false } };

export default function ConfirmPage({ searchParams }: PageProps<"/newsletter/confirm">) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-16 text-center" data-clarity-mask="True">
      <Suspense fallback={<p className="text-muted-foreground">Confirming…</p>}><Confirm searchParams={searchParams} /></Suspense>
    </div>
  );
}

/** Double opt-in: only the inbox owner can subscribe an address (stops spam sign-ups of other people's emails). */
async function Confirm({ searchParams }: { searchParams: PageProps<"/newsletter/confirm">["searchParams"] }) {
  const sp = await searchParams;
  const e = z.string().trim().toLowerCase().email().max(254).safeParse(sp.e);
  if (!e.success || !verifyEmailToken("subscribe", e.data, typeof sp.t === "string" ? sp.t : "")) {
    return <><h1 className="font-heading text-4xl">Link expired</h1><p className="mt-3 text-muted-foreground">Please subscribe again from the bottom of any page.</p></>;
  }
  await unsuppress(e.data); // confirming is an explicit opt-in
  const [added] = await db.insert(s.subscribers).values({ email: e.data, source: "newsletter" }).onConflictDoNothing().returning();
  if (added) {
    await sendEmail(e.data, "Welcome to the Melaré circle", "You’re in",
      "<p>Thank you for joining the Melaré circle. You’ll be first to hear about launches, restocks and members-only offers.</p><p>Here’s 10% off your first order (sign in at checkout to use it): <strong>WELCOME10</strong></p>",
      { label: "Start shopping", url: `${process.env.NEXT_PUBLIC_APP_URL}/shop` }, { marketing: true });
  }
  return (
    <>
      <ScrubUrl />
      <h1 className="font-heading text-4xl">You’re in ✦</h1>
      <p className="mt-3 text-muted-foreground">Your 10% welcome code is <strong className="select-all">WELCOME10</strong>. Sign in at checkout to use it on your first order.</p>
      <Link href="/shop" className={`${buttonPrimary} mt-6`}>Start shopping</Link>
    </>
  );
}
