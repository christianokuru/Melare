import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ForgotPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Reset password", robots: { index: false, follow: true } };

export default function Page() {
  return (
    <AuthShell title="Reset password" subtitle="Enter your email and we’ll send you a secure reset link." image="site/routine-towel.webp" alt="Calm skincare routine">
      <Suspense fallback={null}><ForgotPasswordForm /></Suspense>
    </AuthShell>
  );
}
