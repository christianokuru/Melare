import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { db, schema } from "@/db";
import { sendEmail, escapeHtml, APP_URL } from "./email";
import { randomCode } from "./utils";

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
    sendResetPassword: async ({ user, url }) =>
      sendEmail(user.email, "Reset your Melaré password", "Reset your password",
        `<p>Hi ${escapeHtml(user.name)}, tap below to choose a new password. This link expires in 30 minutes.</p><p>If you didn’t ask for this, you can ignore this email.</p>`,
        { label: "Reset password", url }),
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    expiresIn: 60 * 60 * 24,
    sendVerificationEmail: async ({ user, url }) =>
      sendEmail(user.email, "Confirm your email · Melaré", "Welcome to Melaré",
        `<p>Hi ${escapeHtml(user.name)}, please confirm your email to finish creating your account.</p>`,
        { label: "Confirm email", url }),
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
  },
  session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24, cookieCache: { enabled: true, maxAge: 60 * 5 } },
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
    },
  },
  advanced: { ipAddress: { ipAddressHeaders: ["x-real-ip", "x-forwarded-for"] } },
  databaseHooks: {
    user: { create: { before: async (user) => ({ data: { ...user, referralCode: randomCode(8) } }) } },
  },
  plugins: [nextCookies()], // must stay last
});

export type SessionUser = typeof auth.$Infer.Session.user;

export const getSession = async () => auth.api.getSession({ headers: await headers() });

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
