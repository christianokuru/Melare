import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthShell } from "@/components/auth/auth-shell";
import { SignInForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Welcome back", robots: { index: false, follow: true } };

export default function Page() {
  return (
    <AuthShell title="Welcome back" subtitle="Sign in to track orders, reorder favourites and check out faster." image="site/portrait-afro.webp" alt="Woman with glowing, healthy skin">
      <Suspense fallback={null}><SignInForm /></Suspense>
    </AuthShell>
  );
}
