import { formatMoney, type Currency } from "@/lib/money";
import { cn } from "@/lib/utils";

export function Price({ amount, compareAt, currency, className }: { amount: number; compareAt?: number | null; currency: Currency; className?: string }) {
  return (
    <span className={cn("inline-flex items-baseline gap-2", className)}>
      <span>{formatMoney(amount, currency)}</span>
      {compareAt && compareAt > amount ? (
        <s className="text-[0.85em] text-muted-foreground"><span className="sr-only">Was </span>{formatMoney(compareAt, currency)}</s>
      ) : null}
    </span>
  );
}
