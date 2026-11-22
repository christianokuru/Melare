import "server-only";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getClientIp } from "./request";

/**
 * Fixed-window rate limit stored in Postgres (shared across serverless instances).
 * Returns true when the caller is allowed.
 */
export async function throttle(action: string, limit: number, windowSec: number, id?: string) {
  const key = `${action}:${id ?? (await getClientIp())}`;
  const { rows } = await db.execute<{ count: number }>(sql`
    insert into throttle (key, count, reset_at) values (${key}, 1, now() + make_interval(secs => ${windowSec}))
    on conflict (key) do update set
      count = case when throttle.reset_at < now() then 1 else throttle.count + 1 end,
      reset_at = case when throttle.reset_at < now() then now() + make_interval(secs => ${windowSec}) else throttle.reset_at end
    returning count`);
  return Number(rows[0].count) <= limit;
}
