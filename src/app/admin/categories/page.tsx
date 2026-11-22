import { asc } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { PageTitle } from "@/components/admin/ui";
import { CategoryEditor } from "./editor";

// Fresh admin check on every request, so this route blocks rather than prefetching.
export const instant = false;

export default async function AdminCategories() {
  await requireAdmin();
  const cats = await db.select().from(s.categories).orderBy(asc(s.categories.position));
  return <><PageTitle title="Categories" /><CategoryEditor categories={cats.map(({ createdAt: _c, updatedAt: _u, ...c }) => c)} /></>;
}
