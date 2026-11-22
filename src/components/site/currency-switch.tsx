"use client";
import { useTransition } from "react";
import { setCurrency } from "@/app/actions/store";
import type { Currency } from "@/lib/money";
import { cn } from "@/lib/utils";

export function CurrencySwitch({ value, className }: { value: Currency; className?: string }) {
  const [pending, start] = useTransition();
  return (
    <div role="group" aria-label="Currency" className={cn("inline-flex rounded-full border border-foreground/25 p-0.5", pending && "opacity-60", className)}>
      {(["NGN", "USD"] as const).map((c) => (
        <button key={c} type="button" aria-pressed={value === c} disabled={pending}
          onClick={() => value !== c && start(() => setCurrency(c))}
          className={cn("min-h-7 rounded-full px-2.5 text-[11px] tracking-[0.08em] transition-colors", value === c ? "bg-foreground text-background" : "text-foreground")}>
          {c === "NGN" ? "₦ NGN" : "$ USD"}
        </button>
      ))}
    </div>
  );
}
