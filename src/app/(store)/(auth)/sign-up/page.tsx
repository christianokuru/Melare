import type { Metadata } from "next";
import { Suspense } from "react";
import { SignUpForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Create your account", robots: { index: false, follow: true } };

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-14">
      <h1 className="text-center font-heading text-[40px] leading-none">Create your account</h1>
      <p className="mt-3 mb-8 text-center text-muted-foreground">Faster checkout, order tracking, favourites and a referral code to share.</p>
      <Suspense fallback={null}><SignUpForm /></Suspense>
    </div>
  );
}
