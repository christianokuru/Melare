import { desc, isNull, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { PageTitle, Table, td } from "@/components/admin/ui";
import { CouponCreate, CouponToggle } from "./coupon-forms";

// Fresh admin check on every request, so this route blocks rather than prefetching.
export const instant = false;

export default async function AdminCoupons() {
  await requireAdmin();
  const coupons = await db.select({
    c: s.coupons,
    revenue: sql<number>`(select coalesce(sum(total),0)::int from orders o where o.coupon_id = ${s.coupons.id} and o.status in ('paid','processing','shipped','delivered') and o.currency = 'NGN')`,
  }).from(s.coupons).where(isNull(s.coupons.userId)).orderBy(desc(s.coupons.createdAt));
  return (
    <>
      <PageTitle title="Coupons" />
      <CouponCreate />
      <Table className="mt-8" head={["Code", "Discount", "Owner / campaign", "Used", "NGN revenue", "Expires", ""]}>
        {coupons.map(({ c, revenue }) => (
          <tr key={c.id} className={c.active ? "" : "opacity-50"}>
            <td className={`${td} font-medium`}>{c.code}</td>
            <td className={td}>{c.percentOff ? `${c.percentOff}%` : `${formatMoney(c.amountOffNgn ?? 0, "NGN")} / ${formatMoney(c.amountOffUsd ?? 0, "USD")}`}</td>
            <td className={td}>{c.ownerName ?? "-"}</td>
            <td className={td}>{c.redemptions}{c.maxRedemptions ? ` / ${c.maxRedemptions}` : ""}</td>
            <td className={td}>{formatMoney(revenue, "NGN")}</td>
            <td className={td}>{c.expiresAt?.toLocaleDateString("en-GB") ?? "Never"}</td>
            <td className={td}><CouponToggle id={c.id} active={c.active} /></td>
          </tr>
        ))}
      </Table>
    </>
  );
}
