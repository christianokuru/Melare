import { desc } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getSession, isAdmin } from "@/lib/auth";

// Neutralise spreadsheet formula injection and quote every field.
const cell = (v: string) => `"${(/^[=+\-@\t\r]/.test(v) ? `'${v}` : v).replace(/"/g, '""')}"`;

export async function GET() {
  const session = await getSession();
  if (!isAdmin(session?.user)) return new Response("Not found", { status: 404 });
  const rows = await db.select().from(s.subscribers).orderBy(desc(s.subscribers.createdAt));
  const csv = ["email,source,joined", ...rows.map((r) => [r.email, r.source, r.createdAt.toISOString()].map(cell).join(","))].join("\n");
  return new Response(csv, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="melare-subscribers.csv"', "Cache-Control": "no-store" } });
}
