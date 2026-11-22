import { asc } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { PageTitle } from "@/components/admin/ui";
import { ZoneEditor } from "./editor";

export default async function AdminShipping() {
  await requireAdmin();
  const zones = await db.select().from(s.shippingZones).orderBy(asc(s.shippingZones.position));
  return (
    <>
      <PageTitle title="Shipping zones" />
      <p className="mb-4 text-sm text-muted-foreground">Matching order: exact country + state, then country, then the rest-of-world zone (country “*”). Amounts in ₦ / $.</p>
      <ZoneEditor zones={zones.map(({ createdAt: _c, updatedAt: _u, ...z }) => z)} />
    </>
  );
}
