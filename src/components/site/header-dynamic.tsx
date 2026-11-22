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
  const href = !session ? "/sign-in" : isAdmin(session.user) ? "/admin" : "/account";
  return <Link href={href} aria-label={session ? "Your account" : "Sign in"} className="flex size-11 items-center justify-center"><UserIcon /></Link>;
}

export async function HeaderCurrency({ className }: { className?: string }) {
  return <CurrencySwitch value={await getCurrency()} className={className} />;
}
