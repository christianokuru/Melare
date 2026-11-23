import "server-only";
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
import * as schema from "./schema";

// `ws` is steadier than Node's built-in WebSocket on flaky networks.
neonConfig.webSocketConstructor = ws;

// WebSocket pool: supports interactive transactions (row locks for checkout/payments).
// Short idle timeout so we never reuse a socket the network or Neon (on suspend) silently dropped.
const globalForDb = globalThis as unknown as { pool?: Pool };
const pool =
  globalForDb.pool ??
  new Pool({ connectionString: process.env.DATABASE_URL, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 15_000 });
if (!globalForDb.pool) pool.on("error", (err: Error) => console.error("[db] idle connection dropped:", err.message)); // never crash the process
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
export { schema };
