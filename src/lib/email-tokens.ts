import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

type Purpose = "unsubscribe" | "subscribe";
const TTL: Record<Purpose, number> = { unsubscribe: 365 * 86400, subscribe: 7 * 86400 }; // seconds
const APP_URL = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");

const mac = (data: string) => createHmac("sha256", process.env.BETTER_AUTH_SECRET ?? "").update(data).digest("base64url");

/** Signed, expiring token tied to one email + purpose (no DB needed, can't be forged or reused for another address). */
export function signEmailToken(purpose: Purpose, email: string) {
  if (!process.env.BETTER_AUTH_SECRET) throw new Error("BETTER_AUTH_SECRET is required");
  const exp = Math.floor(Date.now() / 1000) + TTL[purpose];
  return `${exp}.${mac(`${purpose}|${email.toLowerCase()}|${exp}`)}`;
}

export function verifyEmailToken(purpose: Purpose, email: string, token: string) {
  const [exp, sig] = String(token).split(".");
  if (!process.env.BETTER_AUTH_SECRET || !exp || !sig || Number(exp) < Date.now() / 1000) return false;
  const want = Buffer.from(mac(`${purpose}|${email.toLowerCase()}|${exp}`));
  const got = Buffer.from(sig);
  return got.length === want.length && timingSafeEqual(got, want);
}

const link = (path: string, purpose: Purpose, email: string) =>
  `${APP_URL}${path}?${new URLSearchParams({ e: email.toLowerCase(), t: signEmailToken(purpose, email) })}`;
export const unsubscribeUrl = (email: string) => link("/unsubscribe", "unsubscribe", email);
export const oneClickUnsubscribeUrl = (email: string) => link("/api/unsubscribe", "unsubscribe", email);
export const confirmSubscribeUrl = (email: string) => link("/newsletter/confirm", "subscribe", email);
