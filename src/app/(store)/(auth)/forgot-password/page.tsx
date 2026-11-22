import type { Metadata } from "next";
import { Suspense } from "react";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Reset password", robots: { index: false, follow: true } };

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-14">
      <h1 className="text-center font-heading text-[40px] leading-none">Reset password</h1>
      <p className="mt-3 mb-8 text-center text-muted-foreground">Enter your email and we’ll send you a secure reset link.</p>
      <Suspense fallback={null}><ForgotPasswordForm /></Suspense>
    </div>
  );
}
