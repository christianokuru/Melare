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

export async function getClientIp() {
  const h = await headers();
  return h.get("x-real-ip") ?? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export const secureCookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};
