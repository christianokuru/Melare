import Link from "next/link";
import { cn } from "@/lib/utils";

export const container = "mx-auto w-full max-w-[1440px] px-4 lg:px-10";

export function SectionHeading({ title, eyebrow, href, linkLabel = "Shop all", center, as: H = "h2", className }: {
  title: React.ReactNode; eyebrow?: string; href?: string; linkLabel?: string; center?: boolean; as?: "h1" | "h2"; className?: string;
}) {
  return (
    <div className={cn("mb-8 flex items-end gap-4", center ? "flex-col items-center text-center" : "justify-between", className)}>
      <div>
        {eyebrow && <p className="eyebrow mb-2 text-muted-foreground">{eyebrow}</p>}
        <H className="font-heading text-[32px] leading-[1.05] lg:text-5xl">{title}</H>
      </div>
      {href && <Link href={href} className="eyebrow shrink-0 underline underline-offset-4">{linkLabel}</Link>}
    </div>
  );
}

export function Breadcrumbs({ items }: { items: { name: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-xs text-muted-foreground">
      <ol className="flex flex-wrap items-center gap-1.5">
        {items.map((it, i) => (
          <li key={it.name} className="flex items-center gap-1.5">
            {i > 0 && <span aria-hidden>/</span>}
            {it.href ? <Link href={it.href} className="hover:underline underline-offset-4">{it.name}</Link> : <span aria-current="page">{it.name}</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export const buttonPrimary = "inline-flex h-12 items-center justify-center rounded-full bg-foreground px-8 text-[12px] uppercase tracking-[0.14em] text-background transition-opacity hover:opacity-90 disabled:opacity-50";
export const buttonOutline = "inline-flex h-12 items-center justify-center rounded-full border border-foreground px-8 text-[12px] uppercase tracking-[0.14em] transition-colors hover:bg-foreground hover:text-background disabled:opacity-50";
export const inputClass = "h-12 w-full rounded-xl border border-input bg-white px-4 text-[15px] outline-none transition-colors placeholder:text-muted-foreground focus:border-foreground aria-[invalid=true]:border-destructive";
export const labelClass = "mb-1.5 block text-[13px]";
