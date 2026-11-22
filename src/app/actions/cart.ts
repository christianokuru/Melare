"use server";
import { z } from "zod";
import { refresh } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getCartLines, resolveCartId } from "@/lib/cart";
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
  const data = parsed.data;
  const cartId = (await resolveCartId(true))!;

  const ref = "variantId" in data ? { variantId: data.variantId } : { bundleId: data.bundleId };
  const where = "variantId" in data
    ? and(eq(s.cartItems.cartId, cartId), eq(s.cartItems.variantId, data.variantId))
    : and(eq(s.cartItems.cartId, cartId), eq(s.cartItems.bundleId, data.bundleId));
  const [existing] = await db.select().from(s.cartItems).where(where);
  const wanted = (existing?.quantity ?? 0) + data.quantity;

  // Check availability against live stock using the same pricing path as checkout.
  const probe = existing ? existing.id : (await db.insert(s.cartItems).values({ cartId, ...ref, quantity: 1 }).returning())[0].id;
  const line = (await getCartLines(cartId)).find((l) => l.id === probe);
  if (!line || line.maxQty === 0) {
    if (!existing) await db.delete(s.cartItems).where(eq(s.cartItems.id, probe));
    return { ok: false, error: "Sorry, this is out of stock." };
  }
  const quantity = Math.min(wanted, line.maxQty);
  await db.update(s.cartItems).set({ quantity }).where(eq(s.cartItems.id, probe));
  await db.update(s.carts).set({ updatedAt: new Date(), remindersSent: 0 }).where(eq(s.carts.id, cartId));
  refresh();
  if (quantity < wanted) return { ok: false, error: `Only ${line.maxQty} available. Your bag has been updated.` };
  return { ok: true, count: await count(cartId) };
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
