"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [
  ["Dashboard", "/admin"], ["Orders", "/admin/orders"], ["Products", "/admin/products"], ["Categories", "/admin/categories"],
  ["Bundles", "/admin/bundles"], ["Coupons", "/admin/coupons"], ["Reviews", "/admin/reviews"], ["Customers", "/admin/customers"],
  ["Shipping", "/admin/shipping"], ["Subscribers", "/admin/subscribers"],
] as const;

export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:px-3">
      {LINKS.map(([label, href]) => {
        const active = href === "/admin" ? path === href : path.startsWith(href);
        return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("shrink-0 rounded-full px-4 py-2 text-sm lg:rounded-xl", active ? "bg-foreground text-background" : "hover:bg-petal")}>{label}</Link>;
      })}
    </nav>
  );
}
