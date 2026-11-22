import { desc } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getSession, isAdmin } from "@/lib/auth";
import { csvResponse } from "@/lib/csv";

export async function GET() {
  if (!isAdmin((await getSession())?.user)) return new Response("Not found", { status: 404 });
  const rows = await db.select().from(s.subscribers).orderBy(desc(s.subscribers.createdAt));
  return csvResponse("melare-subscribers.csv", ["email", "source", "joined"], rows.map((r) => [r.email, r.source, r.createdAt.toISOString()]));
}
