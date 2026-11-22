import Link from "next/link";
import { getCart } from "@/lib/cart";
import { getCurrency } from "@/lib/request";
import { getSession, isAdmin } from "@/lib/auth";
import { BagIcon, UserIcon } from "./icons";
import { CurrencySwitch } from "./currency-switch";

// Request-time header pieces. Each renders inside its own <Suspense>.
export async function BagLink() {
  const { count } = await getCart();
  return (
    <Link href="/cart" aria-label={`Bag, ${count} item${count === 1 ? "" : "s"}`} className="relative flex size-11 items-center justify-center">
      <BagIcon />
      {count > 0 && <span className="absolute top-1.5 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-foreground px-1 text-[9px] text-background">{count}</span>}
    </Link>
  );
}

export async function AccountLink() {
  const session = await getSession();
  if (!session) return <Link href="/sign-in" aria-label="Sign in" className="flex size-11 items-center justify-center"><UserIcon /></Link>;
  if (isAdmin(session.user)) {
    return <Link href="/admin" aria-label="Admin dashboard" className="flex h-11 items-center px-1"><span className="eyebrow rounded-full bg-foreground px-2.5 py-1 text-[10px] text-background">Admin</span></Link>;
  }
  return (
    <Link href="/account" aria-label="Your account" className="flex size-11 items-center justify-center">
      <span className="flex size-8 items-center justify-center rounded-full border border-gold/50 bg-blush text-[11px] font-medium uppercase tracking-wide">{initials(session.user.name || session.user.email)}</span>
    </Link>
  );
}

/** "Ada Obi" → "AO", "ada" → "A". */
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

export async function HeaderCurrency({ className }: { className?: string }) {
  return <CurrencySwitch value={await getCurrency()} className={className} />;
}
