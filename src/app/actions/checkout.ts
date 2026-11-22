"use server";
import { z } from "zod";
import { redirect } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { getSession } from "@/lib/auth";
import { getCartLines, resolveCartId } from "@/lib/cart";
import { getCurrency } from "@/lib/request";
import { throttle } from "@/lib/throttle";
import { randomCode } from "@/lib/utils";
import { COUNTRIES, ORDER_PAYMENT_WINDOW_MIN } from "@/lib/constants";
import {
  applyCode, expireStaleOrders, lineUnit, logOrderEvent, OutOfStockError, releaseOrderStock, reserveStock, shippingFee, stockNeeds, subtotalOf, zoneFor,
  type Applied, type Buyer,
} from "@/lib/checkout";
import { createPaymentLink } from "@/lib/payments";

const text = (max: number) => z.string().trim().min(1).max(max);
const Address = z.object({
  fullName: text(80),
  phone: z.string().trim().regex(/^\+?[0-9][0-9\s-]{6,19}$/, "Enter a valid phone number"),
  line1: text(120),
  line2: z.string().trim().max(120).optional().default(""),
  city: text(60),
  state: text(60),
  country: z.string().refine((c) => c in COUNTRIES, "Choose a country"),
  postalCode: z.string().trim().max(20).optional().default(""),
});
const CheckoutInput = Address.extend({
  email: z.string().trim().toLowerCase().email().max(254),
  code: z.string().trim().max(32).optional().default(""),
  saveAddress: z.boolean().optional().default(false),
});

export type Quote = {
  currency: "NGN" | "USD"; subtotal: number; discount: number; shipping: number; total: number;
  zone: string | null; eta: string | null; codeError?: string; codeApplied?: string;
};

async function buyerFor(email: string): Promise<Buyer> {
  const session = await getSession();
  return session ? { userId: session.user.id, email: session.user.email.toLowerCase() } : { userId: null, email };
}

/** Live order summary for the checkout page. Same math as placeOrder. */
export async function quoteCheckout(input: { country: string; state: string; code?: string; email?: string }): Promise<Quote | { error: string }> {
  if (!(await throttle("quote", 40, 600))) return { error: "Too many attempts. Please wait a few minutes." };
  const country = input.country in COUNTRIES ? input.country : "NG";
  const currency = await getCurrency();
  const lines = await getCartLines(await resolveCartId());
  const subtotal = subtotalOf(lines, currency);
  const buyer = await buyerFor(z.string().email().safeParse(input.email).success ? input.email!.toLowerCase() : "");
  let discount = 0, codeError: string | undefined, codeApplied: string | undefined;
  if (input.code?.trim() && subtotal > 0) {
    if (!buyer.email) codeError = "Enter your email first to apply a code.";
    else {
      const r = await applyCode(input.code, buyer, currency, subtotal);
      if (r.ok) { discount = r.applied.discount; codeApplied = r.applied.code; } else codeError = r.error;
    }
  }
  const zone = await zoneFor(country, input.state);
  const shipping = zone && subtotal > 0 ? shippingFee(zone, currency, subtotal - discount) : 0;
  return { currency, subtotal, discount, shipping, total: subtotal - discount + shipping, zone: zone?.name ?? null, eta: zone?.eta ?? null, codeError, codeApplied };
}

export async function placeOrder(input: z.input<typeof CheckoutInput>): Promise<{ error: string; fields?: Record<string, string> }> {
  const parsed = CheckoutInput.safeParse(input);
  if (!parsed.success) {
    const fields = Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message]));
    return { error: "Please check the highlighted fields.", fields };
  }
  if (!(await throttle("checkout", 10, 600))) return { error: "Too many checkout attempts. Please wait a few minutes." };
  const d = parsed.data;
  const session = await getSession();
  const buyer = await buyerFor(d.email);
  const currency = await getCurrency();
  await expireStaleOrders();

  const cartId = await resolveCartId();
  const lines = await getCartLines(cartId);
  if (!cartId || !lines.length) return { error: "Your bag is empty." };
  if (lines.some((l) => l.maxQty < l.quantity)) return { error: "Some items in your bag changed availability. Please review your bag." };

  const zone = await zoneFor(d.country, d.state);
  if (!zone) return { error: "We don’t deliver to this location yet." };

  const number = `MLR-${randomCode(8)}`;
  const reference = `${number}-${randomCode(6)}`;
  let order: { id: string; total: number };
  try {
    order = await db.transaction(async (tx) => {
      const subtotal = subtotalOf(lines, currency);
      let applied: Applied | null = null;
      if (d.code) {
        const r = await applyCode(d.code, buyer, currency, subtotal, tx);
        if (!r.ok) throw new CheckoutError(r.error);
        applied = r.applied;
      }
      const discount = applied?.discount ?? 0;
      const shipping = shippingFee(zone, currency, subtotal - discount);
      const total = subtotal - discount + shipping;

      await reserveStock(tx, stockNeeds(lines));
      const [o] = await tx.insert(s.orders).values({
        number, userId: buyer.userId, email: buyer.email, currency, subtotal, shippingFee: shipping, discount, total,
        couponId: applied?.kind === "coupon" ? applied.couponId : null,
        referrerId: applied?.kind === "referral" ? applied.referrerId : null,
        shippingAddress: { fullName: d.fullName, phone: d.phone, line1: d.line1, line2: d.line2 || null, city: d.city, state: d.state, country: d.country, postalCode: d.postalCode || null },
        shippingZone: `${zone.name} · ${zone.eta}`, cartId,
        expiresAt: new Date(Date.now() + ORDER_PAYMENT_WINDOW_MIN * 60_000),
      }).returning({ id: s.orders.id, total: s.orders.total });
      await tx.insert(s.orderItems).values(lines.map((l) => ({
        orderId: o.id, productId: l.productId, bundleId: l.kind === "bundle" ? l.refId : null,
        name: l.name, label: l.label, image: l.image, unitPrice: lineUnit(l, currency), quantity: l.quantity,
        stock: l.stock.map((st) => ({ variantId: st.variantId, quantity: st.quantity * l.quantity })),
      })));
      await tx.insert(s.payments).values({ orderId: o.id, reference, amount: total, currency });
      await logOrderEvent(tx, o.id, "pending", "Order placed, awaiting payment");
      return o;
    });
  } catch (e) {
    if (e instanceof CheckoutError) return { error: e.message };
    if (e instanceof OutOfStockError) return { error: "Sorry, an item just sold out. Please review your bag." };
    throw e;
  }

  let link: string;
  try {
    link = await createPaymentLink({ reference, amount: order.total, currency, email: buyer.email, name: d.fullName, phone: d.phone });
  } catch (e) {
    console.error("[checkout] payment link failed", e);
    await db.transaction(async (tx) => {
      await releaseOrderStock(tx, order.id);
      await tx.update(s.orders).set({ status: "cancelled", note: "Payment could not be started" }).where(eq(s.orders.id, order.id));
      await logOrderEvent(tx, order.id, "cancelled", "Payment could not be started");
    });
    return { error: "We couldn’t connect to our payment partner. Please try again in a moment." };
  }

  await db.update(s.carts).set({ email: buyer.email }).where(eq(s.carts.id, cartId));
  if (session && d.saveAddress) {
    const [{ n }] = await db.select({ n: count() }).from(s.addresses).where(eq(s.addresses.userId, session.user.id));
    if (n < 10) {
      await db.insert(s.addresses).values({
        userId: session.user.id, fullName: d.fullName, phone: d.phone, line1: d.line1, line2: d.line2 || null,
        city: d.city, state: d.state, country: d.country, postalCode: d.postalCode || null, isDefault: n === 0,
      });
    }
  }
  redirect(link);
}

/** Resume payment for an unpaid, unexpired order owned by this shopper (account, or same browser cart). */
export async function retryPayment(orderNumber: string): Promise<{ error: string }> {
  if (!(await throttle("retry-pay", 10, 600))) return { error: "Too many attempts. Please wait a few minutes." };
  const session = await getSession();
  const cartId = await resolveCartId();
  const [o] = await db.select().from(s.orders).where(eq(s.orders.number, String(orderNumber).slice(0, 20)));
  const owns = o && ((session && o.userId === session.user.id) || (!o.userId && cartId && o.cartId === cartId));
  if (!o || !owns) return { error: "Order not found." };
  if (o.status !== "pending" || o.expiresAt < new Date()) return { error: "This order can no longer be paid. Please place a new order." };
  const reference = `${o.number}-${randomCode(6)}`;
  await db.insert(s.payments).values({ orderId: o.id, reference, amount: o.total, currency: o.currency });
  let link: string;
  try {
    link = await createPaymentLink({ reference, amount: o.total, currency: o.currency as "NGN" | "USD", email: o.email, name: o.shippingAddress.fullName, phone: o.shippingAddress.phone });
  } catch {
    return { error: "We couldn’t connect to our payment partner. Please try again in a moment." };
  }
  redirect(link);
}

class CheckoutError extends Error {}
