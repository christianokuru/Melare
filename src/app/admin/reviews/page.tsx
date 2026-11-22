import { asc, desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { PageTitle } from "@/components/admin/ui";
import { Stars } from "@/components/product/stars";
import { ReviewActions } from "./review-actions";

// Fresh admin check on every request, so this route blocks rather than prefetching.
export const instant = false;

export default async function AdminReviews() {
  await requireAdmin();
  const rows = await db.select({ r: s.reviews, product: s.products.name, email: s.user.email }).from(s.reviews)
    .innerJoin(s.products, eq(s.products.id, s.reviews.productId)).innerJoin(s.user, eq(s.user.id, s.reviews.userId))
    .orderBy(asc(s.reviews.approved), desc(s.reviews.createdAt)).limit(200);
  return (
    <>
      <PageTitle title="Reviews" />
      {!rows.length && <p className="text-sm text-muted-foreground">No reviews yet. Only verified buyers can review.</p>}
      <ul className="grid gap-3">
        {rows.map(({ r, product, email }) => (
          <li key={r.id} className={`rounded-2xl border bg-white p-5 ${r.approved ? "" : "border-gold"}`}>
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{product} · {r.authorName} ({email}) · {r.skinType} skin · {r.createdAt.toLocaleDateString("en-GB")}</span>
              <span>{r.approved ? "Published" : "Awaiting approval"}</span>
            </div>
            <div className="mt-2"><Stars rating={r.rating} /></div>
            <p className="mt-1 font-medium">{r.title}</p>
            <p className="mt-1 text-sm">{r.body}</p>
            <ReviewActions id={r.id} approved={r.approved} />
          </li>
        ))}
      </ul>
    </>
  );
}
