import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getSession, isAdmin } from "@/lib/auth";
import { container } from "@/components/site/section";
import { AccountNav } from "./nav";

// Fresh session check on every request, so this route blocks rather than prefetching.
export const instant = false;

export const metadata: Metadata = { title: "My account", robots: { index: false, follow: false } };

export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <div className={`${container} pt-8`}>
      <h1 className="font-heading text-[40px] leading-none lg:text-5xl">My account</h1>
      <Suspense fallback={<div className="my-6 h-[53px] border-b" />}><AccountNav /></Suspense>
      <Suspense fallback={null}><AdminToDashboard /></Suspense>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-sand" />}>{children}</Suspense>
    </div>
  );
}

/** The admin has no customer dashboard: sign-in and email-verification links land on /account, so send them to /admin. */
async function AdminToDashboard() {
  if (isAdmin((await getSession())?.user)) redirect("/admin");
  return null;
}
