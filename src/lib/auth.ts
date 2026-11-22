import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { admin } from "better-auth/plugins";
import { headers } from "next/headers";
import { db, schema } from "@/db";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: { enabled: true },
  socialProviders: process.env.GOOGLE_CLIENT_ID
    ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET! } }
    : undefined,
  user: { additionalFields: { phone: { type: "string", required: false } } },
  plugins: [admin({ defaultRole: "customer", adminRoles: ["admin"] }), nextCookies()], // nextCookies must be last
});

export const getSession = async () => auth.api.getSession({ headers: await headers() });

export async function requireAdmin() {
  const s = await getSession();
  if (s?.user.role !== "admin") throw new Response("Forbidden", { status: 403 });
  return s;
}
