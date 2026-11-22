"use client";
import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setCurrency } from "@/app/actions/currency";
import type { Currency } from "@/lib/currency";
import { cn } from "@/lib/utils";

export function CurrencySwitcher({ value }: { value: Currency }) {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <div role="group" aria-label="Currency" className={cn("inline-flex rounded-full border p-0.5 text-xs", pending && "opacity-60")}>
      {(["NGN", "USD"] as const).map((c) => (
        <button
          key={c}
          type="button"
          aria-pressed={value === c}
          onClick={() => start(async () => { await setCurrency(c); router.refresh(); })}
          className={cn("rounded-full px-3 py-1.5 font-medium transition-colors",
            value === c ? "bg-primary text-primary-foreground" : "text-muted-foreground")}
        >
          {c === "NGN" ? "₦ NGN" : "$ USD"}
        </button>
      ))}
    </div>
  );
}
