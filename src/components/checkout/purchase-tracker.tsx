"use client";
import { useEffect } from "react";
import { track } from "@/lib/track";

/** Fires the purchase event once per order (guards against refreshes). */
export function PurchaseTracker({ orderNumber, currency, value, items }: { orderNumber: string; currency: string; value: number; items: { item_id: string; item_name: string; price: number; quantity: number }[] }) {
  useEffect(() => {
    const key = `tracked:${orderNumber}`;
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, "1"); } catch { /* storage blocked: still track once per mount */ }
    track("purchase", currency, value, items, { transaction_id: orderNumber });
  }, [orderNumber, currency, value, items]);
  return null;
}
