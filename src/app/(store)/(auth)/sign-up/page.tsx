import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignUpForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Create your account", robots: { index: false, follow: true } };

export default function Page() {
  return (
    <AuthShell title="Create your account" subtitle="Faster checkout, order tracking, favourites and a referral code to share." image="site/apply-cream.webp" alt="Applying a gentle moisturiser">
      <Suspense fallback={null}><SignUpForm /></Suspense>
    </AuthShell>
  );
}
