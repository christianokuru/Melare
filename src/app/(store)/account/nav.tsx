"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Gift, Heart, House, Package, UserRound, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS = [["Overview", "/account"], ["Orders", "/account/orders"], ["Rewards", "/account/rewards"], ["Favourites", "/account/wishlist"], ["Addresses", "/account/addresses"], ["Settings", "/account/settings"]] as const;
const TABS: [string, string, LucideIcon, string[]][] = [
  ["Home", "/account", House, []], ["Orders", "/account/orders", Package, []], ["Rewards", "/account/rewards", Gift, []],
  ["Saved", "/account/wishlist", Heart, []], ["Account", "/account/settings", UserRound, ["/account/addresses"]],
];
const isActive = (path: string, href: string, also: readonly string[] = []) =>
  href === "/account" ? path === href : [href, ...also].some((h) => path.startsWith(h));

/** Desktop: pill nav. Phones: app-style bottom tab bar (data-tabbar lifts the WhatsApp button above it). */
export function AccountNav() {
  const path = usePathname();
  return (
    <>
      <nav aria-label="Account" className="no-scrollbar -mx-4 my-6 flex gap-2 overflow-x-auto border-b px-4 pb-3 max-lg:hidden">
        {LINKS.map(([label, href]) => {
          const active = isActive(path, href);
          return <Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("eyebrow shrink-0 rounded-full px-4 py-2.5", active ? "bg-foreground text-background" : "hover:bg-blush")}>{label}</Link>;
        })}
      </nav>
      <div className="h-6 lg:hidden" />
      <nav aria-label="Account" data-tabbar className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <ul className="grid grid-cols-5">
          {TABS.map(([label, href, Icon, also]) => {
            const active = isActive(path, href, also);
            return (
              <li key={href}>
                <Link href={href} aria-current={active ? "page" : undefined} className={cn("flex flex-col items-center gap-1 py-2.5 text-[10px] uppercase tracking-[0.08em]", active ? "text-foreground" : "text-muted-foreground")}>
                  <Icon className="size-5" strokeWidth={active ? 2 : 1.5} aria-hidden />{label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
