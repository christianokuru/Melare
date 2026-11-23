import "server-only";
import { cookies, headers } from "next/headers";
import { isCurrency, type Currency } from "./money";

export const CURRENCY_COOKIE = "currency";
export const CART_COOKIE = "cart_id";

/** Chosen currency (cookie) → else NGN for Nigerian visitors, USD elsewhere. */
export async function getCurrency(): Promise<Currency> {
  const c = (await cookies()).get(CURRENCY_COOKIE)?.value;
  if (isCurrency(c)) return c;
  const country = (await headers()).get("x-vercel-ip-country");
  return country && country !== "NG" ? "USD" : "NGN";
}

/**
 * Client IP for rate limits. `x-vercel-forwarded-for` is set by Vercel's edge and can't be spoofed. Generic proxy headers are
 * trusted only on Vercel or when TRUST_PROXY_HEADERS=1 (behind your own proxy); otherwise a client could fake them to dodge limits.
 * Without a trusted header everyone shares one "unknown" bucket (fail closed, logged in production).
 */
export async function getClientIp() {
  const h = await headers();
  const vercel = h.get("x-vercel-forwarded-for")?.split(",")[0]?.trim();
  if (vercel) return vercel;
  if (process.env.VERCEL || process.env.TRUST_PROXY_HEADERS === "1") {
    const ip = h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (ip) return ip;
  }
  if (process.env.NODE_ENV === "production") console.warn("[rate-limit] no trusted client IP header; set TRUST_PROXY_HEADERS=1 behind your proxy");
  return "unknown";
}

export const secureCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
