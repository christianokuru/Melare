"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ShoppingBag, Package, Tags, Gift, TicketPercent, Star, Users, ShoppingCart, Truck, Mail, Settings, type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

const LINKS: [string, string, LucideIcon][] = [
  ["Dashboard", "/admin", LayoutDashboard], ["Orders", "/admin/orders", ShoppingBag], ["Products", "/admin/products", Package],
  ["Categories", "/admin/categories", Tags], ["Bundles", "/admin/bundles", Gift], ["Coupons", "/admin/coupons", TicketPercent],
  ["Reviews", "/admin/reviews", Star], ["Customers", "/admin/customers", Users], ["Abandoned bags", "/admin/abandoned", ShoppingCart],
  ["Shipping", "/admin/shipping", Truck], ["Subscribers", "/admin/subscribers", Mail], ["Settings", "/admin/settings", Settings],
];

/** `counts` maps a link to a badge number (e.g. orders to ship). */
export function AdminNav({ counts = {} }: { counts?: Record<string, number> }) {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="no-scrollbar flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col">
      {LINKS.map(([label, href, Icon]) => {
        const active = href === "/admin" ? path === href : path.startsWith(href);
        const n = counts[href] ?? 0;
        return (
          <Link key={href} href={href} aria-current={active ? "page" : undefined}
            className={cn("flex shrink-0 items-center gap-2.5 rounded-full px-4 py-2 text-sm lg:rounded-xl", active ? "bg-foreground text-background" : "hover:bg-petal")}>
            <Icon className="size-4 shrink-0" strokeWidth={1.6} aria-hidden />
            <span className="lg:flex-1">{label}</span>
            {n > 0 && <span className={cn("min-w-5 rounded-full px-1.5 py-0.5 text-center text-[11px] leading-none", active ? "bg-background text-foreground" : "bg-foreground text-background")} aria-label={`${n} need attention`}>{n > 99 ? "99+" : n}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
