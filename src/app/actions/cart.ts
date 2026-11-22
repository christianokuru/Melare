"use server";
import { z } from "zod";
import { refresh } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getCartLines, resolveCartId } from "@/lib/cart";
import { getSession } from "@/lib/auth";
import { getOwnedOrder } from "@/lib/account";
import { throttle } from "@/lib/throttle";
import { MAX_LINE_QTY } from "@/lib/constants";

export type CartResult = { ok: true; count: number } | { ok: false; error: string };

const Qty = z.coerce.number().int().min(1).max(MAX_LINE_QTY);
const AddInput = z.union([
  z.object({ variantId: z.string().uuid(), quantity: Qty }),
  z.object({ bundleId: z.string().uuid(), quantity: Qty }),
]);

async function count(cartId: string) {
  return (await getCartLines(cartId)).reduce((n, l) => n + l.quantity, 0);
}

export async function addToCart(input: z.input<typeof AddInput>): Promise<CartResult> {
  const parsed = AddInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid item." };
  if (!(await throttle("cart", 60, 60))) return { ok: false, error: "Too many requests. Try again shortly." };
  const cartId = (await resolveCartId(true))!;
  const r = await addLine(cartId, parsed.data);
  refresh();
  if (!r.ok) return r;
  if (r.capped) return { ok: false, error: `Only ${r.capped} available. Your bag has been updated.` };
  return { ok: true, count: await count(cartId) };
}

/** Adds (or tops up) one line, capped to live stock. Unknown/unavailable items are rejected. */
async function addLine(cartId: string, data: z.output<typeof AddInput>): Promise<{ ok: true; capped: number | null } | { ok: false; error: string }> {
  const ref = "variantId" in data ? { variantId: data.variantId } : { bundleId: data.bundleId };
  const where = "variantId" in data
    ? and(eq(s.cartItems.cartId, cartId), eq(s.cartItems.variantId, data.variantId))
    : and(eq(s.cartItems.cartId, cartId), eq(s.cartItems.bundleId, data.bundleId));
  const [existing] = await db.select().from(s.cartItems).where(where);
  const wanted = (existing?.quantity ?? 0) + data.quantity;

  // Check availability against live stock using the same pricing path as checkout.
  // ON CONFLICT handles a concurrent add of the same item (double tap).
  let probe = existing?.id;
  try {
    probe ??= (await db.insert(s.cartItems).values({ cartId, ...ref, quantity: 1 }).onConflictDoNothing().returning())[0]?.id
      ?? (await db.select().from(s.cartItems).where(where))[0].id;
  } catch (e) {
    if (String((e as { code?: string }).code) === "23503") return { ok: false, error: "Sorry, this item is no longer available." }; // deleted product
    throw e;
  }
  const line = (await getCartLines(cartId)).find((l) => l.id === probe);
  if (!line || line.maxQty === 0) {
    if (!existing) await db.delete(s.cartItems).where(eq(s.cartItems.id, probe));
    return { ok: false, error: "Sorry, this is out of stock." };
  }
  const quantity = Math.min(wanted, line.maxQty);
  await db.update(s.cartItems).set({ quantity }).where(eq(s.cartItems.id, probe));
  await db.update(s.carts).set({ updatedAt: new Date(), remindersSent: 0 }).where(eq(s.carts.id, cartId));
  return { ok: true, capped: quantity < wanted ? line.maxQty : null };
}

/** "Buy again": puts every still-available item from one of your orders back in your bag. */
export async function buyAgain(orderNumber: string): Promise<{ ok: true; added: number; unavailable: number } | { ok: false; error: string }> {
  const session = await getSession();
  if (!session) return { ok: false, error: "Please sign in again." };
  if (!(await throttle("buy-again", 20, 3600, session.user.id))) return { ok: false, error: "Too many requests. Try again shortly." };
  const order = await getOwnedOrder(String(orderNumber).toUpperCase().slice(0, 20), session.user.id, session.user.email);
  if (!order) return { ok: false, error: "Order not found." };
  const cartId = (await resolveCartId(true))!;
  let added = 0;
  for (const item of order.items) {
    const variantId = item.stock[0]?.variantId;
    const ref = item.bundleId ? { bundleId: item.bundleId } : variantId ? { variantId } : null;
    if (ref && (await addLine(cartId, { ...ref, quantity: Math.min(item.quantity, MAX_LINE_QTY) })).ok) added++;
  }
  refresh();
  return { ok: true, added, unavailable: order.items.length - added };
}

const UpdateInput = z.object({ itemId: z.string().uuid(), quantity: z.coerce.number().int().min(0).max(MAX_LINE_QTY) });

export async function updateCartItem(input: z.input<typeof UpdateInput>): Promise<CartResult> {
  const parsed = UpdateInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid quantity." };
  const cartId = await resolveCartId();
  if (!cartId) return { ok: false, error: "Your bag is empty." };
  const { itemId, quantity } = parsed.data;
  const own = and(eq(s.cartItems.id, itemId), eq(s.cartItems.cartId, cartId)); // ownership enforced in SQL
  if (quantity === 0) {
    await db.delete(s.cartItems).where(own);
  } else {
    const line = (await getCartLines(cartId)).find((l) => l.id === itemId);
    if (!line) return { ok: false, error: "Item not found." };
    await db.update(s.cartItems).set({ quantity: Math.max(1, Math.min(quantity, line.maxQty || 1)) }).where(own);
  }
  await db.update(s.carts).set({ updatedAt: new Date() }).where(eq(s.carts.id, cartId));
  refresh();
  return { ok: true, count: await count(cartId) };
}

export async function removeCartItem(itemId: string): Promise<CartResult> {
  return updateCartItem({ itemId, quantity: 0 });
}
