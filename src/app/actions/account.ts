"use server";
import { z } from "zod";
import { refresh } from "next/cache";
import { and, count, eq, ne } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getSession } from "@/lib/auth";
import { throttle } from "@/lib/throttle";
import { COUNTRIES } from "@/lib/constants";
import type { Currency } from "@/lib/money";

type Result = { ok: true } | { ok: false; error: string };
const UNAUTH = { ok: false as const, error: "Please sign in again." };
const phone = z.string().trim().regex(/^\+?[0-9][0-9\s-]{6,19}$/, "Enter a valid phone number");

export async function updateProfile(input: { name: string; phone: string }): Promise<Result> {
  const session = await getSession();
  if (!session) return UNAUTH;
  const parsed = z.object({ name: z.string().trim().min(2).max(80), phone: z.union([phone, z.literal("")]) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  await db.update(s.user).set({ name: parsed.data.name, phone: parsed.data.phone || null }).where(eq(s.user.id, session.user.id));
  refresh();
  return { ok: true };
}

const AddressInput = z.object({
  id: z.string().uuid().optional(),
  fullName: z.string().trim().min(2).max(80),
  phone,
  line1: z.string().trim().min(3).max(120),
  line2: z.string().trim().max(120).optional().default(""),
  city: z.string().trim().min(2).max(60),
  state: z.string().trim().min(2).max(60),
  country: z.string().refine((c) => c in COUNTRIES, "Choose a country"),
  postalCode: z.string().trim().max(20).optional().default(""),
  isDefault: z.boolean().optional().default(false),
});

export async function saveAddress(input: z.input<typeof AddressInput>): Promise<Result> {
  const session = await getSession();
  if (!session) return UNAUTH;
  const parsed = AddressInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (!(await throttle("address", 30, 3600, session.user.id))) return { ok: false, error: "Too many changes. Try again later." };
  const { id, ...d } = parsed.data;
  const uid = session.user.id;
  const values = { ...d, line2: d.line2 || null, postalCode: d.postalCode || null };
  try {
  await db.transaction(async (tx) => {
    const [{ n }] = await tx.select({ n: count() }).from(s.addresses).where(eq(s.addresses.userId, uid));
    let savedId = id;
    if (id) {
      const updated = await tx.update(s.addresses).set(values).where(and(eq(s.addresses.id, id), eq(s.addresses.userId, uid))).returning();
      if (!updated.length) throw new AddressError("Address not found");
    } else {
      if (n >= 10) throw new AddressError("You can save up to 10 addresses");
      [{ id: savedId }] = await tx.insert(s.addresses).values({ ...values, userId: uid, isDefault: d.isDefault || n === 0 }).returning({ id: s.addresses.id });
    }
    if (d.isDefault) {
      await tx.update(s.addresses).set({ isDefault: false }).where(and(eq(s.addresses.userId, uid), ne(s.addresses.id, savedId!)));
    }
  });
  } catch (e) {
    if (e instanceof AddressError) return { ok: false, error: e.message };
    throw e;
  }
  refresh();
  return { ok: true };
}

export async function deleteAddress(id: string): Promise<Result> {
  const session = await getSession();
  if (!session) return UNAUTH;
  if (!z.string().uuid().safeParse(id).success) return { ok: false, error: "Invalid address." };
  await db.delete(s.addresses).where(and(eq(s.addresses.id, id), eq(s.addresses.userId, session.user.id)));
  refresh();
  return { ok: true };
}

class AddressError extends Error {}

/** Guest order lookup: requires the exact order number AND checkout email. Rate limited against enumeration. */
export async function lookupOrder(input: { number: string; email: string }) {
  const parsed = z.object({ number: z.string().trim().toUpperCase().regex(/^MLR-[A-Z0-9]{8}$/), email: z.string().trim().toLowerCase().email() }).safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Check your order number and email." };
  if (!(await throttle("lookup", 10, 900))) return { ok: false as const, error: "Too many attempts. Please wait 15 minutes." };
  const [o] = await db.select().from(s.orders).where(and(eq(s.orders.number, parsed.data.number), eq(s.orders.email, parsed.data.email)));
  if (!o) return { ok: false as const, error: "We couldn’t find an order with those details." };
  const items = await db.select({ name: s.orderItems.name, label: s.orderItems.label, quantity: s.orderItems.quantity, unitPrice: s.orderItems.unitPrice, image: s.orderItems.image })
    .from(s.orderItems).where(eq(s.orderItems.orderId, o.id));
  return {
    ok: true as const,
    order: {
      number: o.number, status: o.status, currency: o.currency as Currency, total: o.total, subtotal: o.subtotal, shippingFee: o.shippingFee, discount: o.discount,
      createdAt: o.createdAt.toISOString(), trackingNumber: o.trackingNumber, shippingZone: o.shippingZone, city: o.shippingAddress.city, items,
    },
  };
}
