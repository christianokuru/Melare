import type { Metadata } from "next";
import { Suspense } from "react";
import { z } from "zod";
import { verifyEmailToken } from "@/lib/email-tokens";
import { ScrubUrl } from "@/components/scrub-url";
import { UnsubscribeButton } from "./unsubscribe-button";

export const metadata: Metadata = { title: "Unsubscribe", robots: { index: false, follow: false } };

export default function UnsubscribePage({ searchParams }: PageProps<"/unsubscribe">) {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-16 text-center" data-clarity-mask="True">
      <Suspense fallback={null}><Body searchParams={searchParams} /></Suspense>
    </div>
  );
}

// A confirm button (not GET-unsubscribe) so email link scanners can't unsubscribe people by "clicking" the link.
async function Body({ searchParams }: { searchParams: PageProps<"/unsubscribe">["searchParams"] }) {
  const sp = await searchParams;
  const e = z.string().email().max(254).safeParse(sp.e);
  const t = typeof sp.t === "string" ? sp.t : "";
  if (!e.success || !verifyEmailToken("unsubscribe", e.data, t)) {
    return <><h1 className="font-heading text-4xl">Link expired</h1><p className="mt-3 text-muted-foreground">This unsubscribe link isn’t valid any more. Use the link in a recent email, or turn off emails in your account settings.</p></>;
  }
  return (
    <>
      <ScrubUrl />
      <h1 className="font-heading text-4xl">Unsubscribe</h1>
      <p className="mt-3 text-muted-foreground">Stop offers, reminders and newsletters to <strong>{e.data}</strong>? You’ll still get emails about orders you place.</p>
      <UnsubscribeButton email={e.data} token={t} />
    </>
  );
}
