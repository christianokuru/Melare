import type { Metadata } from "next";
import { Suspense } from "react";
import { container } from "@/components/site/section";
import { AccountNav } from "./nav";

export const metadata: Metadata = { title: "My account", robots: { index: false, follow: false } };

export default function AccountLayout({ children }: LayoutProps<"/account">) {
  return (
    <div className={`${container} pt-8`}>
      <h1 className="font-heading text-[40px] leading-none lg:text-5xl">My account</h1>
      <Suspense fallback={<div className="my-6 h-[53px] border-b" />}><AccountNav /></Suspense>
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-sand" />}>{children}</Suspense>
    </div>
  );
}
