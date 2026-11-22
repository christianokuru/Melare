import Image from "next/image";
import Link from "next/link";
import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { listOrders, reviewPrompts, runningLow, skinProfile } from "@/lib/account";
import { getProducts } from "@/lib/catalog";
import { formatMoney, type Currency } from "@/lib/money";
import { CONCERNS, REFERRAL_REWARD } from "@/lib/constants";
import { OrderTracker, StatusBadge, progressDates } from "@/components/order/order-view";
import { BuyAgainButton } from "@/components/order/buy-again";
import { ReorderButton } from "./reorder-button";

// Fresh session check on every request, so this route blocks rather than prefetching.
export const instant = false;

export default async function AccountPage() {
  const { user } = await requireUser("/account");
  const [orders, low, toReview, profile, rewards] = await Promise.all([
    listOrders(user.id, user.email, 4),
    runningLow(user.id, user.email),
    reviewPrompts(user.id, user.email),
    skinProfile(user.id, user.email),
    db.select({ id: s.coupons.id }).from(s.coupons).where(and(eq(s.coupons.userId, user.id), eq(s.coupons.active, true), eq(s.coupons.redemptions, 0), or(isNull(s.coupons.expiresAt), gt(s.coupons.expiresAt, new Date())))),
  ]);
  const active = orders.find((o) => ["paid", "processing", "shipped"].includes(o.status));
  const events = active ? await db.select({ status: s.orderEvents.status, createdAt: s.orderEvents.createdAt }).from(s.orderEvents).where(inArray(s.orderEvents.orderId, [active.id])) : [];
  const picks = profile ? (await getProducts()).filter((p) => profile.productIds.includes(p.id)).slice(0, 3) : [];
  const card = "rounded-2xl border p-6";

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_380px]">
      <div className="grid min-w-0 content-start gap-10">
        <p className="text-lg">Hi {user.name.split(" ")[0]} ✦</p>

        {active && (
          <section className="rounded-2xl bg-blush p-6" aria-labelledby="active-order">
            <div className="mb-6 flex flex-wrap items-baseline justify-between gap-2">
              <h2 id="active-order" className="font-heading text-2xl">Order {active.number}</h2>
              <Link href={`/account/orders/${active.number}`} className="eyebrow underline underline-offset-4">Details</Link>
            </div>
            <OrderTracker status={active.status} progress={progressDates(active, events)} />
            {active.trackingNumber && <p className="mt-5 text-sm">Tracking number: <strong className="select-all">{active.trackingNumber}</strong></p>}
          </section>
        )}

        {low.length > 0 && (
          <section aria-labelledby="running-low">
            <h2 id="running-low" className="font-heading text-2xl">Running low?</h2>
            <p className="mt-1 mb-4 text-sm text-muted-foreground">Based on when you ordered, these are about to run out. Reorder in one tap.</p>
            <ul className="grid gap-3 sm:grid-cols-2">
              {low.map((p) => (
                <li key={p.productId} className="flex items-center gap-4 rounded-2xl border p-4">
                  {p.image && <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-sand"><Image src={p.image} alt="" fill sizes="64px" className="object-cover" /></div>}
                  <div className="min-w-0 flex-1 text-sm">
                    <Link href={`/products/${p.slug}`} className="hover:underline">{p.name}</Link>
                    <p className="text-muted-foreground">{p.label} · {p.daysLeft > 0 ? `about ${p.daysLeft} day${p.daysLeft === 1 ? "" : "s"} left` : "probably finished"}</p>
                  </div>
                  <ReorderButton variantId={p.variantId} name={p.name} />
                </li>
              ))}
            </ul>
          </section>
        )}

        <section aria-labelledby="recent-orders">
          <div className="flex items-baseline justify-between">
            <h2 id="recent-orders" className="font-heading text-2xl">Recent orders</h2>
            <Link href="/account/orders" className="eyebrow underline underline-offset-4">View all</Link>
          </div>
          {orders.length ? (
            <ul className="mt-4 divide-y border-y">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-3 py-4 text-sm">
                  <Link href={`/account/orders/${o.number}`} className="min-w-0 hover:underline"><span className="block">{o.number}</span><span className="text-muted-foreground">{o.createdAt.toLocaleDateString("en-GB")} · {formatMoney(o.total, o.currency as Currency)}</span></Link>
                  <span className="flex shrink-0 items-center gap-3">
                    <StatusBadge status={o.status} />
                    {o.status === "delivered" && <BuyAgainButton number={o.number} className="eyebrow underline underline-offset-4 disabled:opacity-50" />}
                  </span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-4 text-muted-foreground">No orders yet. <Link href="/shop" className="underline">Start shopping</Link>.</p>}
        </section>

        {toReview.length > 0 && (
          <section className="rounded-2xl bg-blush p-6 text-sm" aria-labelledby="reviews-due">
            <h2 id="reviews-due" className="font-heading text-2xl">How’s your skin loving it?</h2>
            <p className="mt-1 text-muted-foreground">Your review helps others with skin like yours.</p>
            <ul className="mt-4 flex flex-wrap gap-2">{toReview.map((p) => <li key={p.id}><Link href={`/products/${p.slug}#reviews`} className="eyebrow inline-block rounded-full border border-foreground px-4 py-2.5">Review {p.name}</Link></li>)}</ul>
          </section>
        )}
      </div>

      <aside className="grid h-fit gap-4">
        <section className={card} aria-labelledby="skin-profile">
          <p id="skin-profile" className="eyebrow text-muted-foreground">Your skin profile</p>
          {profile ? (
            <>
              <p className="mt-2 font-heading text-2xl">{profile.answers.skinType} skin</p>
              {profile.answers.concerns?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">{profile.answers.concerns.map((c) => <span key={c} className="rounded-full bg-blush px-3 py-1.5 text-xs">{CONCERNS.find((x) => x.slug === c)?.name ?? c}</span>)}</div>
              )}
              {picks.length > 0 && (
                <ul className="mt-4 grid gap-2 text-sm">{picks.map((p) => <li key={p.id}><Link href={`/products/${p.slug}`} className="flex items-center gap-3 hover:underline"><span className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-sand"><Image src={p.image} alt="" fill sizes="40px" className="object-cover" /></span>{p.name}</Link></li>)}</ul>
              )}
              <Link href="/quiz" className="eyebrow mt-4 inline-block underline underline-offset-4">Retake the quiz</Link>
            </>
          ) : (
            <>
              <p className="mt-2 text-sm">Take our 2-minute skin quiz and we’ll keep your routine here.</p>
              <Link href="/quiz" className="eyebrow mt-4 inline-block rounded-full border border-foreground px-4 py-2.5">Take the quiz</Link>
            </>
          )}
        </section>
        <Link href="/account/rewards" className="block rounded-2xl bg-blush p-6 hover:bg-petal">
          <p className="eyebrow text-muted-foreground">Rewards</p>
          <p className="mt-2 text-sm">Give {formatMoney(REFERRAL_REWARD.NGN, "NGN")}, get {formatMoney(REFERRAL_REWARD.NGN, "NGN")} with your code <strong className="tracking-wide">{user.referralCode}</strong>.</p>
          <p className="mt-3 text-sm">{rewards.length ? `You have ${rewards.length} code${rewards.length === 1 ? "" : "s"} ready to use →` : "See your codes and invite friends →"}</p>
        </Link>
      </aside>
    </div>
  );
}
