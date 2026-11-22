import Link from "next/link";
import { cn } from "@/lib/utils";

export function PageTitle({ title, action }: { title: string; action?: { label: string; href: string } }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="font-heading text-4xl">{title}</h1>
      {action && <Link href={action.href} className="rounded-full bg-foreground px-5 py-2.5 text-xs uppercase tracking-[0.12em] text-background">{action.label}</Link>}
    </div>
  );
}

export function Table({ head, children, className }: { head: string[]; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("overflow-x-auto rounded-2xl border bg-white", className)}>
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead className="bg-blush/60 text-xs uppercase tracking-[0.08em] text-muted-foreground"><tr>{head.map((h) => <th key={h} className="px-4 py-3 font-normal">{h}</th>)}</tr></thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  );
}

export const td = "px-4 py-3 align-middle";
export const adminInput = "h-10 w-full rounded-lg border border-input bg-white px-3 text-sm outline-none focus:border-foreground";
export const adminLabel = "mb-1 block text-xs text-muted-foreground";
export const adminButton = "inline-flex h-10 items-center justify-center rounded-full bg-foreground px-5 text-xs uppercase tracking-[0.12em] text-background disabled:opacity-50";
export const adminGhost = "inline-flex h-10 items-center justify-center rounded-full border border-foreground/30 px-5 text-xs uppercase tracking-[0.12em] disabled:opacity-50";
