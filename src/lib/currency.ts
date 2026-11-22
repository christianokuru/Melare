import { cookies } from "next/headers";

export const CURRENCIES = ["NGN", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const CURRENCY_COOKIE = "currency";

/** Customer's chosen currency (cookie). Defaults to NGN for Nigerian visitors, else USD. */
export async function getCurrency(country?: string | null): Promise<Currency> {
  const c = (await cookies()).get(CURRENCY_COOKIE)?.value;
  if (c === "NGN" || c === "USD") return c;
  return country && country !== "NG" ? "USD" : "NGN";
}

export const priceFor = (v: { priceNgn: number; priceUsd: number }, c: Currency) =>
  c === "NGN" ? v.priceNgn : v.priceUsd;

/** Format minor units: 1500000 → ₦15,000 · 2500 → $25.00 */
export const formatMoney = (minor: number, c: Currency) =>
  new Intl.NumberFormat(c === "NGN" ? "en-NG" : "en-US", {
    style: "currency", currency: c, maximumFractionDigits: c === "NGN" ? 0 : 2,
  }).format(minor / 100);
