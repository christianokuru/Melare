"use server";
import { cookies } from "next/headers";
import { CURRENCY_COOKIE, type Currency } from "@/lib/currency";

export async function setCurrency(c: Currency) {
  if (c !== "NGN" && c !== "USD") return;
  (await cookies()).set(CURRENCY_COOKIE, c, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}
