"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const LINKS = [["Overview", "/account"], ["Orders", "/account/orders"], ["Favourites", "/account/wishlist"], ["Addresses", "/account/addresses"], ["Settings", "/account/settings"]] as const;

export function AccountNav() {
  const path = usePathname();
  return (
    <nav aria-label="Account" className="no-scrollbar -mx-4 my-6 flex gap-2 overflow-x-auto border-b px-4 pb-3">
      {LINKS.map(([label, href]) => {
        const active = href === "/account" ? path === href : path.startsWith(href);
        return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("eyebrow shrink-0 rounded-full px-4 py-2.5", active ? "bg-foreground text-background" : "hover:bg-blush")}>{label}</Link>;
      })}
    </nav>
  );
}
