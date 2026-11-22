import type { Metadata } from "next";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { PAID_STATUSES } from "@/lib/order-status";
import { REFERRAL_REWARD, SITE } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { CopyButton } from "../copy-button";
import { ShareButton } from "../share-button";

export const instant = false;
export const metadata: Metadata = { title: "Rewards" };

const WELCOME = "WELCOME10";

export default async function RewardsPage() {
  const { user } = await requireUser("/account/rewards");
  const email = user.email.toLowerCase();
  const [codes, [friends], [subscribed], [welcome]] = await Promise.all([
    db.select().from(s.coupons).where(eq(s.coupons.userId, user.id)).orderBy(desc(s.coupons.createdAt)),
    db.select({ n: sql<number>`count(*)::int` }).from(s.orders).where(and(eq(s.orders.referrerId, user.id), inArray(s.orders.status, [...PAID_STATUSES]))),
    db.select({ email: s.subscribers.email }).from(s.subscribers).where(sql`lower(${s.subscribers.email}) = ${email}`),
    db.select({ id: s.coupons.id, percentOff: s.coupons.percentOff,
      used: sql<boolean>`exists (select 1 from orders o where o.coupon_id = ${s.coupons.id} and lower(o.email) = ${email} and o.status not in ('pending', 'cancelled'))` })
      .from(s.coupons).where(and(eq(s.coupons.code, WELCOME), eq(s.coupons.active, true))),
  ]);
  const now = new Date();
  type Code = { code: string; value: string; note: string; state: "Ready to use" | "Used" | "Expired" };
  const wallet: Code[] = codes.map((c) => ({
    code: c.code,
    value: c.percentOff ? `${c.percentOff}% off` : `${formatMoney(c.amountOffNgn ?? 0, "NGN")} / ${formatMoney(c.amountOffUsd ?? 0, "USD")} off`,
    note: c.code.startsWith("THANKS-") ? "Referral reward · one use" : "Personal code",
    state: c.redemptions >= (c.maxRedemptions ?? Infinity) || !c.active ? "Used" : c.expiresAt && c.expiresAt < now ? "Expired" : "Ready to use",
  }));
  if (subscribed && welcome) wallet.push({ code: WELCOME, value: `${welcome.percentOff}% off`, note: "Newsletter welcome · first order", state: welcome.used ? "Used" : "Ready to use" });
  const earned = codes.filter((c) => c.code.startsWith("THANKS-")).length;
  const shareText = `I love Melaré skincare. Use my code ${user.referralCode} for ${formatMoney(REFERRAL_REWARD.NGN, "NGN")} off your first order:`;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <section className="h-fit rounded-2xl bg-blush p-6 lg:p-8" aria-labelledby="refer">
        <p id="refer" className="eyebrow text-muted-foreground">Give {formatMoney(REFERRAL_REWARD.NGN, "NGN")}, get {formatMoney(REFERRAL_REWARD.NGN, "NGN")}</p>
        <p className="mt-2 text-sm">Friends get {formatMoney(REFERRAL_REWARD.NGN, "NGN")} ({formatMoney(REFERRAL_REWARD.USD, "USD")}) off their first order with your code. You get the same as a reward code once they’ve paid.</p>
        <p className="mt-5 font-heading text-4xl tracking-wide select-all">{user.referralCode}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          <CopyButton text={user.referralCode ?? ""} label="Copy code" />
          <a href={`https://wa.me/?text=${encodeURIComponent(`${shareText} ${SITE.url}`)}`} target="_blank" rel="noopener noreferrer" className="eyebrow rounded-full border border-foreground px-4 py-2.5">WhatsApp</a>
          <ShareButton text={shareText} url={SITE.url} />
        </div>
        <dl className="mt-8 grid grid-cols-2 gap-3 text-center">
          <div className="rounded-xl bg-background p-4"><dt className="text-xs text-muted-foreground">Friends who ordered</dt><dd className="mt-1 font-heading text-3xl">{friends.n}</dd></div>
          <div className="rounded-xl bg-background p-4"><dt className="text-xs text-muted-foreground">Rewards earned</dt><dd className="mt-1 font-heading text-3xl">{formatMoney(earned * REFERRAL_REWARD.NGN, "NGN")}</dd></div>
        </dl>
      </section>

      <section aria-labelledby="codes">
        <h2 id="codes" className="font-heading text-2xl">My codes</h2>
        <p className="mt-1 mb-4 text-sm text-muted-foreground">Enter a code at checkout. One code per order.</p>
        {wallet.length ? (
          <ul className="grid gap-3">
            {wallet.map((c) => (
              <li key={c.code} className={cn("flex items-center justify-between gap-4 rounded-2xl border p-4", c.state !== "Ready to use" && "opacity-60")}>
                <div className="min-w-0">
                  <p className="font-medium tracking-wide select-all">{c.code}</p>
                  <p className="text-xs text-muted-foreground">{c.value} · {c.note}</p>
                </div>
                {c.state === "Ready to use" ? <CopyButton text={c.code} label="Copy" /> : <span className="text-xs text-muted-foreground">{c.state}</span>}
              </li>
            ))}
          </ul>
        ) : <p className="rounded-2xl border border-dashed p-6 text-sm text-muted-foreground">No codes yet. Share your referral code above, or join our newsletter for 10% off your first order.</p>}
      </section>
    </div>
  );
}
