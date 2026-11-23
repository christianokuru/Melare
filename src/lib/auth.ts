import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { eq, sql } from "drizzle-orm";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { db, schema } from "@/db";
import { sendEmail, APP_URL } from "./email";
import { cleanName, PERSON_NAME, randomCode } from "./utils";

/** Validates names on EVERY write path (sign-up, update-user, social), not just our forms. */
function checkName(name: unknown) {
  const n = cleanName(name);
  if (!PERSON_NAME.test(n)) throw new APIError("BAD_REQUEST", { message: "Please enter your name using letters only (2–80 characters)." });
  return n;
}

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? APP_URL,
  trustedOrigins: [APP_URL],
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    revokeSessionsOnPasswordReset: true,
    resetPasswordTokenExpiresIn: 60 * 30,
    // No user-chosen text (e.g. the name) in auth emails: they go to addresses we haven't verified yet.
    sendResetPassword: async ({ user, url }) =>
      sendEmail(user.email, "Reset your Melaré password", "Reset your password",
        "<p>Tap below to choose a new password. This link expires in 30 minutes.</p><p>If you didn’t ask for this, ignore this email: your password stays the same.</p>",
        { label: "Reset password", url }),
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) =>
      sendEmail(user.email, "Confirm your email · Melaré", "Confirm your email",
        "<p>Someone created a Melaré account with this email address. If it was you, confirm below to finish setting it up.</p><p style=\"color:#6B5045\"><strong>Didn’t create an account?</strong> Don’t click the button: ignore this email and the account stays inactive.</p>",
        { label: "Yes, this is my account", url }),
  },
  socialProviders: process.env.GOOGLE_CLIENT_ID
    ? { google: { clientId: process.env.GOOGLE_CLIENT_ID, clientSecret: process.env.GOOGLE_CLIENT_SECRET! } }
    : undefined,
  user: {
    // Not writable by clients: only our own server actions change these.
    additionalFields: {
      phone: { type: "string", required: false, input: false },
      referralCode: { type: "string", required: false, input: false },
    },
    // Customers can delete their account (password required). Orders are kept for accounting, unlinked (user_id → null).
    deleteUser: {
      enabled: true,
      beforeDelete: async (user) => {
        if (isAdmin({ email: user.email, emailVerified: true })) throw new APIError("FORBIDDEN", { message: "The admin account can’t be deleted." });
      },
      afterDelete: async (user) => {
        const email = user.email.toLowerCase();
        await Promise.all([
          db.delete(schema.subscribers).where(sql`lower(${schema.subscribers.email}) = ${email}`),
          db.delete(schema.stockAlerts).where(sql`lower(${schema.stockAlerts.email}) = ${email}`),
          db.delete(schema.quizResults).where(sql`lower(${schema.quizResults.email}) = ${email}`),
          db.update(schema.carts).set({ email: null }).where(eq(schema.carts.email, user.email)),
        ]);
      },
    },
  },
  // No cookie cache: every request checks the DB, so revoked sessions (sign out everywhere, password reset, deletion) die instantly.
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24, cookieCache: { enabled: false } },
  rateLimit: {
    enabled: true,
    storage: "database",
    window: 60,
    max: 60,
    customRules: {
      "/sign-in/email": { window: 300, max: 8 },
      "/sign-up/email": { window: 3600, max: 5 },
      "/request-password-reset": { window: 900, max: 3 },
      "/reset-password": { window: 900, max: 5 },
      "/send-verification-email": { window: 900, max: 3 },
      "/change-password": { window: 900, max: 5 },
      "/delete-user": { window: 900, max: 5 },
    },
  },
  advanced: { ipAddress: { ipAddressHeaders: ["x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"] } },
  databaseHooks: {
    user: {
      // Email sign-up: reject bad names. Social sign-in (Google): sanitise instead of failing the login.
      create: { before: async (user, ctx) => ({ data: { ...user, image: null, referralCode: randomCode(8),
        name: ctx?.path?.startsWith("/sign-up") ? checkName(user.name) : (PERSON_NAME.test(cleanName(String(user.name).replace(/[^\p{L}\p{M} '.-]/gu, ""))) ? cleanName(String(user.name).replace(/[^\p{L}\p{M} '.-]/gu, "")) : "Melaré customer") } }) },
      update: { before: async (data) => ({ data: { ...data, ...("name" in data && { name: checkName(data.name) }), ...("image" in data && { image: null }) } }) },
    },
  },
  plugins: [nextCookies()], // must stay last
});

export type SessionUser = typeof auth.$Infer.Session.user;

// connection() marks every session/cart read as request-time, so DB access (which uses crypto) never runs during prerender.
export const getSession = async () => {
  await connection();
  return auth.api.getSession({ headers: await headers() });
};

/** The single admin: verified owner of ADMIN_EMAIL. Never derived from client-writable data. */
export function isAdmin(user: Pick<SessionUser, "email" | "emailVerified"> | undefined | null) {
  const admin = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  return !!admin && !!user?.emailVerified && user.email.toLowerCase() === admin;
}

export async function requireUser(next = "/account") {
  const s = await getSession();
  if (!s) redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  return s;
}

/** Admin gate for pages AND server actions. Non-admins get a 404 (route existence is not revealed). */
export async function requireAdmin() {
  const s = await getSession();
  if (!isAdmin(s?.user)) notFound();
  return s!;
}
