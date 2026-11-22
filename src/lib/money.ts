export const CURRENCIES = ["NGN", "USD"] as const;
export type Currency = (typeof CURRENCIES)[number];
export const isCurrency = (v: unknown): v is Currency => v === "NGN" || v === "USD";

type Priced = { priceNgn: number; priceUsd: number };
export const priceIn = (v: Priced, c: Currency) => (c === "NGN" ? v.priceNgn : v.priceUsd);

/** Minor units → display. 2850000 → ₦28,500 · 3200 → $32 */
export function formatMoney(minor: number, c: Currency) {
  return new Intl.NumberFormat(c === "NGN" ? "en-NG" : "en-US", {
    style: "currency",
    currency: c,
    minimumFractionDigits: 0,
    maximumFractionDigits: minor % 100 === 0 ? 0 : 2,
  }).format(minor / 100);
}

/** Bundle price: sum of components minus discount, rounded down to a whole unit. */
export const bundlePrice = (sum: number, discountPercent: number) =>
  Math.floor((sum * (100 - discountPercent)) / 100 / 100) * 100;
