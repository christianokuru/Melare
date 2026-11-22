import Link from "next/link";
import { and, eq, isNull, gt, or } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { listOrders } from "@/lib/account";
import { formatMoney, type Currency } from "@/lib/money";
import { REFERRAL_REWARD, SITE } from "@/lib/constants";
import { StatusBadge } from "@/components/order/order-view";
import { CopyButton } from "./copy-button";

// Fresh session check on every request, so this route blocks rather than prefetching.
export const instant = false;

export default async function AccountPage() {
  const { user } = await requireUser("/account");
  const [orders, rewards] = await Promise.all([
    listOrders(user.id, user.email, 3),
    db.select().from(s.coupons).where(and(eq(s.coupons.userId, user.id), eq(s.coupons.active, true), eq(s.coupons.redemptions, 0), or(isNull(s.coupons.expiresAt), gt(s.coupons.expiresAt, new Date())))),
  ]);
  const shareText = `I love Melaré skincare. Use my code ${user.referralCode} for ${formatMoney(REFERRAL_REWARD.NGN, "NGN")} off your first order: ${SITE.url}`;
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_380px]">
      <section>
        <p className="text-lg">Hi {user.name.split(" ")[0]} ✦</p>
        <div className="mt-6 flex items-baseline justify-between">
          <h2 className="font-heading text-2xl">Recent orders</h2>
          <Link href="/account/orders" className="eyebrow underline underline-offset-4">View all</Link>
        </div>
        {orders.length ? (
          <ul className="mt-4 divide-y border-y">
            {orders.map((o) => (
              <li key={o.id}>
                <Link href={`/account/orders/${o.number}`} className="flex items-center justify-between gap-3 py-4 text-sm hover:bg-blush/40">
                  <span><span className="block">{o.number}</span><span className="text-muted-foreground">{o.createdAt.toLocaleDateString("en-GB")}</span></span>
                  <span className="flex items-center gap-3"><StatusBadge status={o.status} />{formatMoney(o.total, o.currency as Currency)}</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : <p className="mt-4 text-muted-foreground">No orders yet. <Link href="/shop" className="underline">Start shopping</Link>.</p>}
      </section>
      <aside className="grid h-fit gap-4">
        <div className="rounded-2xl bg-blush p-6">
          <p className="eyebrow text-muted-foreground">Give {formatMoney(REFERRAL_REWARD.NGN, "NGN")}, get {formatMoney(REFERRAL_REWARD.NGN, "NGN")}</p>
          <p className="mt-2 text-sm">Friends get {formatMoney(REFERRAL_REWARD.NGN, "NGN")} ({formatMoney(REFERRAL_REWARD.USD, "USD")}) off their first order with your code. You get the same once they’ve paid.</p>
          <p className="mt-4 font-heading text-3xl tracking-wide select-all">{user.referralCode}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <CopyButton text={user.referralCode ?? ""} label="Copy code" />
            <a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noopener noreferrer" className="eyebrow rounded-full border border-foreground px-4 py-2.5">Share on WhatsApp</a>
          </div>
        </div>
        {rewards.length > 0 && (
          <div className="rounded-2xl border p-6">
            <p className="eyebrow text-muted-foreground">Your rewards</p>
            <ul className="mt-3 grid gap-2 text-sm">{rewards.map((r) => <li key={r.id} className="flex justify-between"><span className="select-all font-medium">{r.code}</span><span>{formatMoney(r.amountOffNgn ?? 0, "NGN")} off</span></li>)}</ul>
          </div>
        )}
      </aside>
    </div>
  );
}
