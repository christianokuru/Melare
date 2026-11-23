import type { Metadata } from "next";
import { Suspense } from "react";
import { TrackForm } from "./track-form";

export const metadata: Metadata = { title: "Track your order", description: "Check the status of your Melaré order with your order number and email.", alternates: { canonical: "/track" } };

export default function TrackPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-14" data-clarity-mask="True">
      <h1 className="text-center font-heading text-[40px] leading-none lg:text-5xl">Track your order</h1>
      <p className="mt-3 mb-8 text-center text-muted-foreground">Enter the order number from your confirmation email and the email you used at checkout.</p>
      <Suspense fallback={null}><TrackForm /></Suspense>
    </div>
  );
}
