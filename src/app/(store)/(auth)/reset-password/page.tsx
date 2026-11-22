import type { Metadata } from "next";
import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false, follow: true } };

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-14">
      <h1 className="text-center font-heading text-[40px] leading-none">Choose a new password</h1>
      <p className="mt-3 mb-8 text-center text-muted-foreground">For your security, you’ll be signed out of other devices.</p>
      <Suspense fallback={null}><ResetPasswordForm /></Suspense>
    </div>
  );
}
