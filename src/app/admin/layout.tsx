import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { AdminNav } from "@/components/admin/nav";
import { SignOutButton } from "@/components/auth/sign-out-button";

export const metadata: Metadata = { title: { default: "Admin", template: "%s · Admin · Melaré" }, robots: { index: false, follow: false } };

// NOTE: every admin page and action calls requireAdmin() itself; this layout is presentation only.
export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="flex min-h-svh flex-col lg:flex-row">
      <aside className="border-b bg-blush lg:sticky lg:top-0 lg:h-svh lg:w-60 lg:shrink-0 lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between px-4 py-3 lg:block lg:px-6 lg:py-6">
          <Link href="/admin" className="flex items-center gap-2"><Image src="/logo.svg" alt="Melaré" width={92} height={40} className="h-8 w-auto" /><span className="eyebrow text-muted-foreground">Admin</span></Link>
          <div className="flex items-center gap-4 lg:mt-4">
            <Link href="/" className="eyebrow underline underline-offset-4">View store</Link>
            <SignOutButton className="eyebrow underline underline-offset-4 disabled:opacity-50" />
          </div>
        </div>
        <Suspense fallback={<div className="h-12" />}><AdminNav /></Suspense>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 lg:px-10 lg:py-10">
        <div className="mx-auto w-full max-w-[1400px]"><Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-sand" />}>{children}</Suspense></div>
      </main>
    </div>
  );
}
