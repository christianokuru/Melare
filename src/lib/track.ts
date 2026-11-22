"use client";
type Item = { item_id: string; item_name: string; price: number; quantity?: number };
type W = Window & { gtag?: (...a: unknown[]) => void; fbq?: (...a: unknown[]) => void };

const FB: Record<string, string> = { view_item: "ViewContent", add_to_cart: "AddToCart", begin_checkout: "InitiateCheckout", purchase: "Purchase" };

/** Ecommerce event to GA4 + Meta Pixel (no-ops when not configured). Prices in major units. */
export function track(event: keyof typeof FB, currency: string, value: number, items: Item[], extra: Record<string, unknown> = {}) {
  const w = window as W;
  w.gtag?.("event", event, { currency, value, items, ...extra });
  w.fbq?.("track", FB[event], { currency, value, content_ids: items.map((i) => i.item_id), content_type: "product" });
}
