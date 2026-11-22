import { desc, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { PageTitle, Table, td } from "@/components/admin/ui";

// Fresh admin check on every request, so this route blocks rather than prefetching.
export const instant = false;

export default async function AdminSubscribers() {
  await requireAdmin();
  const [rows, [{ n }]] = await Promise.all([
    db.select().from(s.subscribers).orderBy(desc(s.subscribers.createdAt)).limit(200),
    db.select({ n: sql<number>`count(*)::int` }).from(s.subscribers),
  ]);
  return (
    <>
      <PageTitle title={`Subscribers (${n})`} />
      <a href="/admin/subscribers/export" className="mb-4 inline-block text-sm underline underline-offset-4">Download CSV</a>
      <Table head={["Email", "Source", "Joined"]}>
        {rows.map((r) => <tr key={r.email}><td className={td}>{r.email}</td><td className={td}>{r.source}</td><td className={td}>{r.createdAt.toLocaleDateString("en-GB")}</td></tr>)}
      </Table>
    </>
  );
}
