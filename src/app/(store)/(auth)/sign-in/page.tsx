import type { Metadata } from "next";
import { Suspense } from "react";
import { SignInForm } from "@/components/auth/auth-forms";

export const metadata: Metadata = { title: "Welcome back", robots: { index: false, follow: true } };

export default function Page() {
  return (
    <div className="mx-auto w-full max-w-md px-4 py-14">
      <h1 className="text-center font-heading text-[40px] leading-none">Welcome back</h1>
      <p className="mt-3 mb-8 text-center text-muted-foreground">Sign in to track orders, reorder favourites and check out faster.</p>
      <Suspense fallback={null}><SignInForm /></Suspense>
    </div>
  );
}
