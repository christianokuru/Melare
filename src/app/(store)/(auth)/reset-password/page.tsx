import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Choose a new password", robots: { index: false, follow: true } };

export default function Page() {
  return (
    <AuthShell title="Choose a new password" subtitle="For your security, you’ll be signed out of other devices." image="site/routine-towel.webp" alt="Calm skincare routine">
      <Suspense fallback={null}><ResetPasswordForm /></Suspense>
    </AuthShell>
  );
}
