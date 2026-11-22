import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// HTTP driver: ideal for Vercel serverless. Use db.batch([...]) for atomic multi-writes (checkout).
export const db = drizzle(neon(process.env.DATABASE_URL!), { schema, casing: "snake_case" });
export { schema };
