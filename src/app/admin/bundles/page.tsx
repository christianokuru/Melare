import { asc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { PageTitle } from "@/components/admin/ui";
import { BundleEditor } from "./editor";

// Fresh admin check on every request, so this route blocks rather than prefetching.
export const instant = false;

export default async function AdminBundles() {
  await requireAdmin();
  const [bundles, items, variants] = await Promise.all([
    db.select().from(s.bundles).orderBy(asc(s.bundles.name)),
    db.select().from(s.bundleItems),
    db.select({ id: s.productVariants.id, label: s.productVariants.label, name: s.products.name }).from(s.productVariants)
      .innerJoin(s.products, eq(s.products.id, s.productVariants.productId)).orderBy(asc(s.products.name)),
  ]);
  return (
    <>
      <PageTitle title="Bundles" />
      <BundleEditor variants={variants.map((v) => ({ id: v.id, label: `${v.name} · ${v.label}` }))}
        bundles={bundles.map(({ createdAt: _c, updatedAt: _u, ...b }) => ({ ...b, items: items.filter((i) => i.bundleId === b.id).map(({ variantId, quantity }) => ({ variantId, quantity })) }))} />
    </>
  );
}
