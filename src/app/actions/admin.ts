"use server";
import { z } from "zod";
import { refresh, updateTag } from "next/cache";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, schema as s, type Tx } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { CATALOG_TAG } from "@/lib/catalog";
import { logOrderEvent, releaseOrderStock } from "@/lib/checkout";
import { STATUS_LABEL, TRANSITIONS } from "@/lib/order-status";
import { isPushEndpoint, pushToAdmin, pushEnabled } from "@/lib/push";
import { SETTINGS_TAG, type SettingKey } from "@/lib/settings";
import { sendEmail, escapeHtml, APP_URL } from "@/lib/email";
import { CONCERNS, SKIN_TYPES } from "@/lib/constants";
import { randomCode, slugify } from "@/lib/utils";
import { isMediaUrl, MEDIA_FOLDERS } from "@/lib/media";
import { storeImage, UploadError } from "@/lib/storage";
import { throttle } from "@/lib/throttle";

type Result = { ok: true; id?: string } | { ok: false; error: string };
const fail = (e: z.ZodError): Result => ({ ok: false, error: e.issues.map((i) => `${i.path.join(".") || "input"}: ${i.message}`)[0] });
const uuid = z.string().uuid();
const slug = z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "lowercase letters, numbers and dashes");
const imagePath = z.string().trim().refine(isMediaUrl, "upload the image first");
const money = z.coerce.number().int().min(1).max(1_000_000_000); // minor units
const optMoney = z.union([money, z.literal(null)]).optional().default(null);

function done(id?: string): Result {
  updateTag(CATALOG_TAG);
  refresh();
  return { ok: true, id };
}

/* ───────────── Image uploads (Neon Object Storage) ───────────── */
export async function uploadImage(form: FormData): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const session = await requireAdmin();
  if (!(await throttle("upload", 60, 3600, session.user.id))) return { ok: false, error: "Too many uploads. Try again later." };
  const file = form.get("file");
  const folder = z.enum(MEDIA_FOLDERS).safeParse(form.get("folder"));
  if (!(file instanceof File) || !folder.success) return { ok: false, error: "Choose an image to upload." };
  try {
    return { ok: true, url: await storeImage(Buffer.from(await file.arrayBuffer()), folder.data) };
  } catch (e) {
    if (e instanceof UploadError) return { ok: false, error: e.message };
    console.error("[upload]", e);
    return { ok: false, error: "Upload failed. Please try again." };
  }
}

/* ───────────── Products ───────────── */
const ProductInput = z.object({
  id: uuid.optional(),
  slug, name: z.string().trim().min(2).max(100), tagline: z.string().trim().min(2).max(140),
  description: z.string().trim().min(10).max(5000), benefits: z.array(z.string().trim().min(2).max(120)).max(8),
  ingredients: z.string().trim().max(3000).optional().default(""), howToUse: z.string().trim().max(2000).optional().default(""),
  skinTypes: z.array(z.enum(SKIN_TYPES)).max(5), concerns: z.array(z.enum(CONCERNS.map((c) => c.slug) as [string, ...string[]])).max(6),
  categoryId: uuid.nullable(), status: z.enum(["draft", "active", "archived"]), featured: z.boolean(),
  daysSupply: z.union([z.coerce.number().int().min(7).max(365), z.literal(null)]),
  seoTitle: z.string().trim().max(70).optional().default(""), seoDescription: z.string().trim().max(160).optional().default(""),
  variants: z.array(z.object({
    id: uuid.optional(), sku: z.string().trim().min(2).max(40).regex(/^[A-Z0-9-]+$/, "SKU: A–Z, 0–9, dashes"), label: z.string().trim().min(1).max(40),
    priceNgn: money, priceUsd: money, compareAtNgn: optMoney, compareAtUsd: optMoney, stock: z.coerce.number().int().min(0).max(100000),
  })).min(1).max(10),
  images: z.array(z.object({ src: imagePath, alt: z.string().trim().min(2).max(140) })).min(1).max(8),
});

export async function saveProduct(input: z.input<typeof ProductInput>): Promise<Result> {
  await requireAdmin();
  const parsed = ProductInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error);
  const { id, variants, images, ...p } = parsed.data;
  const values = { ...p, ingredients: p.ingredients || null, howToUse: p.howToUse || null, seoTitle: p.seoTitle || null, seoDescription: p.seoDescription || null };
  const restocked: string[] = [];
  try {
    const productId = await db.transaction(async (tx) => {
      let pid = id;
      if (pid) {
        const r = await tx.update(s.products).set(values).where(eq(s.products.id, pid)).returning({ id: s.products.id });
        if (!r.length) throw new AdminError("Product not found");
      } else {
        [{ id: pid }] = await tx.insert(s.products).values(values).returning({ id: s.products.id });
      }
      const existing = await tx.select().from(s.productVariants).where(eq(s.productVariants.productId, pid!));
      const keep = variants.flatMap((v) => (v.id ? [v.id] : []));
      if (keep.some((k) => !existing.find((e) => e.id === k))) throw new AdminError("Variant does not belong to this product");
      const removed = existing.filter((e) => !keep.includes(e.id)).map((e) => e.id);
      if (removed.length) await tx.delete(s.productVariants).where(inArray(s.productVariants.id, removed));
      for (const [position, v] of variants.entries()) {
        const row = { ...v, position, productId: pid! };
        if (v.id) {
          const before = existing.find((e) => e.id === v.id)!;
          if (before.stock === 0 && v.stock > 0) restocked.push(v.id);
          await tx.update(s.productVariants).set(row).where(eq(s.productVariants.id, v.id));
        } else {
          await tx.insert(s.productVariants).values(row);
        }
      }
      await tx.delete(s.productImages).where(eq(s.productImages.productId, pid!));
      await tx.insert(s.productImages).values(images.map((im, position) => ({ ...im, position, productId: pid! })));
      return pid!;
    });
    if (restocked.length) await sendRestockAlerts(restocked);
    return done(productId);
  } catch (e) {
    if (e instanceof AdminError) return { ok: false, error: e.message };
    if (String((e as { code?: string }).code) === "23505") return { ok: false, error: "Slug or SKU already in use." };
    throw e;
  }
}

async function sendRestockAlerts(variantIds: string[]) {
  const rows = await db.select({ email: s.stockAlerts.email, variantId: s.stockAlerts.variantId, label: s.productVariants.label, name: s.products.name, slug: s.products.slug })
    .from(s.stockAlerts).innerJoin(s.productVariants, eq(s.productVariants.id, s.stockAlerts.variantId))
    .innerJoin(s.products, eq(s.products.id, s.productVariants.productId)).where(inArray(s.stockAlerts.variantId, variantIds));
  await Promise.allSettled(rows.map((r) => sendEmail(r.email, `${r.name} is back in stock`, "It’s back",
    `<p>Good news: <strong>${escapeHtml(r.name)} (${escapeHtml(r.label)})</strong> is back in stock. Popular items sell out quickly.</p>`,
    { label: "Shop now", url: `${APP_URL}/products/${r.slug}` })));
  await db.delete(s.stockAlerts).where(inArray(s.stockAlerts.variantId, variantIds));
}

export async function archiveProduct(id: string): Promise<Result> {
  await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid product." };
  await db.update(s.products).set({ status: "archived", featured: false }).where(eq(s.products.id, id));
  return done();
}

/** Inline stock edit from the products list. Restocking from 0 emails "back in stock" subscribers. */
export async function setVariantStock(variantId: string, stock: number): Promise<Result> {
  await requireAdmin();
  const parsed = z.object({ variantId: uuid, stock: z.coerce.number().int().min(0).max(100000) }).safeParse({ variantId, stock });
  if (!parsed.success) return { ok: false, error: "Enter a whole number from 0." };
  const [before] = await db.select({ stock: s.productVariants.stock }).from(s.productVariants).where(eq(s.productVariants.id, parsed.data.variantId));
  if (!before) return { ok: false, error: "Variant not found." };
  await db.update(s.productVariants).set({ stock: parsed.data.stock }).where(eq(s.productVariants.id, parsed.data.variantId));
  if (before.stock === 0 && parsed.data.stock > 0) await sendRestockAlerts([parsed.data.variantId]);
  return done();
}

/** Copies a product (as a draft, stock 0, new slug/SKUs) so similar products are quick to add. */
export async function duplicateProduct(id: string): Promise<Result> {
  await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid product." };
  const suffix = randomCode(4);
  const newId = await db.transaction(async (tx) => {
    const [p] = await tx.select().from(s.products).where(eq(s.products.id, id));
    if (!p) return null;
    const [variants, images] = await Promise.all([
      tx.select().from(s.productVariants).where(eq(s.productVariants.productId, id)).orderBy(asc(s.productVariants.position)),
      tx.select().from(s.productImages).where(eq(s.productImages.productId, id)).orderBy(asc(s.productImages.position)),
    ]);
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = p;
    const [copy] = await tx.insert(s.products).values({
      ...rest, name: `${p.name} (copy)`.slice(0, 100), slug: `${p.slug}-copy-${suffix.toLowerCase()}`.slice(0, 80), status: "draft", featured: false,
    }).returning({ id: s.products.id });
    if (variants.length) await tx.insert(s.productVariants).values(variants.map(({ id: _v, createdAt: _vc, updatedAt: _vu, ...v }) => ({ ...v, productId: copy.id, sku: `${v.sku}-${suffix}`.slice(0, 40), stock: 0 })));
    if (images.length) await tx.insert(s.productImages).values(images.map(({ id: _i, createdAt: _ic, ...im }) => ({ ...im, productId: copy.id })));
    return copy.id;
  });
  return newId ? done(newId) : { ok: false, error: "Product not found." };
}

/* ───────────── Categories ───────────── */
const CategoryInput = z.object({
  id: uuid.optional(), slug, name: z.string().trim().min(2).max(60), description: z.string().trim().max(500).optional().default(""),
  image: z.union([imagePath, z.literal("")]).optional().default(""), position: z.coerce.number().int().min(0).max(999),
});

export async function saveCategory(input: z.input<typeof CategoryInput>): Promise<Result> {
  await requireAdmin();
  const parsed = CategoryInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error);
  const { id, ...c } = parsed.data;
  const values = { ...c, description: c.description || null, image: c.image || null };
  try {
    if (id) await db.update(s.categories).set(values).where(eq(s.categories.id, id));
    else await db.insert(s.categories).values(values);
  } catch (e) {
    if (String((e as { code?: string }).code) === "23505") return { ok: false, error: "Slug already in use." };
    throw e;
  }
  return done();
}

export async function deleteCategory(id: string): Promise<Result> {
  await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid category." };
  await db.delete(s.categories).where(eq(s.categories.id, id)); // products keep existing (category set null)
  return done();
}

/* ───────────── Bundles ───────────── */
const BundleInput = z.object({
  id: uuid.optional(), slug, name: z.string().trim().min(2).max(80), tagline: z.string().trim().min(2).max(140),
  description: z.string().trim().min(10).max(3000), image: imagePath, discountPercent: z.coerce.number().int().min(1).max(50), active: z.boolean(),
  items: z.array(z.object({ variantId: uuid, quantity: z.coerce.number().int().min(1).max(5) })).min(2).max(8)
    .refine((xs) => new Set(xs.map((x) => x.variantId)).size === xs.length, "Each product can appear once"),
});

export async function saveBundle(input: z.input<typeof BundleInput>): Promise<Result> {
  await requireAdmin();
  const parsed = BundleInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error);
  const { id, items, ...b } = parsed.data;
  try {
    await db.transaction(async (tx) => {
      const found = await tx.select({ id: s.productVariants.id }).from(s.productVariants).where(inArray(s.productVariants.id, items.map((i) => i.variantId)));
      if (found.length !== items.length) throw new AdminError("One of the products no longer exists");
      let bid = id;
      if (bid) await tx.update(s.bundles).set(b).where(eq(s.bundles.id, bid));
      else [{ id: bid }] = await tx.insert(s.bundles).values(b).returning({ id: s.bundles.id });
      await tx.delete(s.bundleItems).where(eq(s.bundleItems.bundleId, bid!));
      await tx.insert(s.bundleItems).values(items.map((i) => ({ ...i, bundleId: bid! })));
    });
  } catch (e) {
    if (e instanceof AdminError) return { ok: false, error: e.message };
    if (String((e as { code?: string }).code) === "23505") return { ok: false, error: "Slug already in use." };
    throw e;
  }
  return done();
}

export async function deleteBundle(id: string): Promise<Result> {
  await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid bundle." };
  await db.delete(s.bundles).where(eq(s.bundles.id, id));
  return done();
}

/* ───────────── Coupons ───────────── */
const CouponInput = z.object({
  code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{3,32}$/, "3–32 letters, numbers, dashes"),
  kind: z.enum(["percent", "amount"]),
  percentOff: z.coerce.number().int().min(1).max(90).optional(),
  amountOffNgn: money.optional(), amountOffUsd: money.optional(),
  minSubtotalNgn: optMoney, minSubtotalUsd: optMoney,
  maxRedemptions: z.union([z.coerce.number().int().min(1).max(1_000_000), z.literal(null)]).optional().default(null),
  expiresAt: z.union([z.coerce.date(), z.literal(null)]).optional().default(null),
  ownerName: z.string().trim().max(60).optional().default(""),
}).refine((c) => (c.kind === "percent" ? c.percentOff != null : c.amountOffNgn != null && c.amountOffUsd != null), "Enter the discount value");

export async function createCoupon(input: z.input<typeof CouponInput>): Promise<Result> {
  await requireAdmin();
  const parsed = CouponInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error);
  const { kind, percentOff, amountOffNgn, amountOffUsd, ownerName, ...c } = parsed.data;
  try {
    await db.insert(s.coupons).values({
      ...c, ownerName: ownerName || null,
      ...(kind === "percent" ? { percentOff } : { amountOffNgn, amountOffUsd }),
    });
  } catch (e) {
    if (String((e as { code?: string }).code) === "23505") return { ok: false, error: "That code already exists." };
    throw e;
  }
  refresh();
  return { ok: true };
}

export async function setCouponActive(id: string, active: boolean): Promise<Result> {
  await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid coupon." };
  await db.update(s.coupons).set({ active: !!active }).where(eq(s.coupons.id, id));
  refresh();
  return { ok: true };
}

/* ───────────── Reviews ───────────── */
export async function moderateReview(id: string, action: "approve" | "hide" | "delete"): Promise<Result> {
  await requireAdmin();
  if (!uuid.safeParse(id).success || !["approve", "hide", "delete"].includes(action)) return { ok: false, error: "Invalid request." };
  if (action === "delete") await db.delete(s.reviews).where(eq(s.reviews.id, id));
  else await db.update(s.reviews).set({ approved: action === "approve" }).where(eq(s.reviews.id, id));
  return done();
}

/* ───────────── Orders ───────────── */
const OrderInput = z.object({
  id: uuid,
  status: z.enum(["pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded"]),
  trackingNumber: z.string().trim().max(80).optional(), // undefined = keep current
  note: z.string().trim().max(500).optional(),
  restock: z.boolean().optional().default(true),
});
type Notify = { email: string; number: string; status: string; tracking: string | null };

/** One order update under a row lock: enforces allowed transitions, stock, timeline. Returns whether status changed + the email to send. */
async function applyOrderUpdate(tx: Tx, d: z.output<typeof OrderInput>): Promise<{ changed: boolean; notify: Notify | null }> {
  const [o] = await tx.select().from(s.orders).where(eq(s.orders.id, d.id)).for("update");
  if (!o) throw new AdminError("Order not found");
  const changed = d.status !== o.status;
  const tracking = d.trackingNumber === undefined ? o.trackingNumber : d.trackingNumber || null;
  if (changed && !TRANSITIONS[o.status].includes(d.status)) throw new AdminError(`Can’t move an order from ${STATUS_LABEL[o.status]} to ${STATUS_LABEL[d.status]}`);
  if (changed && d.status === "shipped" && !tracking) throw new AdminError("Add a tracking number before marking as shipped");
  if (changed && (d.status === "cancelled" || (d.status === "refunded" && d.restock))) await releaseOrderStock(tx, o.id);
  const now = new Date();
  await tx.update(s.orders).set({
    status: d.status, trackingNumber: tracking,
    ...(d.note !== undefined ? { note: d.note || null } : {}),
    ...(changed && d.status === "shipped" ? { shippedAt: now } : {}),
    ...(changed && d.status === "delivered" ? { deliveredAt: now } : {}),
  }).where(eq(s.orders.id, o.id));
  if (!changed) return { changed, notify: null };
  await logOrderEvent(tx, o.id, d.status, d.status === "shipped" ? `Tracking number ${tracking}` : null);
  const notify = ["shipped", "delivered", "cancelled", "refunded"].includes(d.status) ? { email: o.email, number: o.number, status: d.status, tracking } : null;
  return { changed, notify };
}

export async function updateOrder(input: z.input<typeof OrderInput>): Promise<Result> {
  await requireAdmin();
  const parsed = OrderInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error);
  try {
    const { notify } = await db.transaction((tx) => applyOrderUpdate(tx, parsed.data));
    if (notify) await sendStatusEmail(notify);
  } catch (e) {
    if (e instanceof AdminError) return { ok: false, error: e.message };
    throw e;
  }
  return done();
}

/** Bulk move (no tracking needed): paid → preparing, shipped → delivered. Orders that can't move are skipped. */
export async function bulkUpdateOrders(ids: string[], status: string): Promise<{ ok: true; updated: number; skipped: number } | { ok: false; error: string }> {
  await requireAdmin();
  const parsed = z.object({ ids: z.array(uuid).min(1).max(100), status: z.enum(["processing", "delivered"]) }).safeParse({ ids, status });
  if (!parsed.success) return { ok: false, error: "Select at least one order." };
  const unique = [...new Set(parsed.data.ids)];
  const emails: Notify[] = [];
  let updated = 0;
  for (const id of unique) {
    try {
      const r = await db.transaction((tx) => applyOrderUpdate(tx, { id, status: parsed.data.status, restock: true }));
      if (r.changed) updated++;
      if (r.notify) emails.push(r.notify);
    } catch (e) {
      if (!(e instanceof AdminError)) throw e;
    }
  }
  await Promise.allSettled(emails.map(sendStatusEmail));
  refresh();
  return { ok: true, updated, skipped: unique.length - updated };
}

async function sendStatusEmail(n: Notify) {
  const copy: Record<string, string> = {
    shipped: `Your order is on its way.${n.tracking ? ` Tracking number: <strong>${escapeHtml(n.tracking)}</strong>.` : ""}`,
    delivered: "Your order has been delivered. We hope you love it. We’d be grateful for a review once you’ve tried it.",
    cancelled: "Your order has been cancelled. If you were charged, your refund will be processed to your original payment method.",
    refunded: "Your refund has been processed to your original payment method. It may take a few business days to appear.",
  };
  await sendEmail(n.email, `Order ${n.number} · ${n.status}`, `Order ${n.number} ${n.status}`, `<p>${copy[n.status]}</p>`,
    { label: "Track order", url: `${APP_URL}/track?number=${n.number}` });
}

/* ───────────── Shipping zones ───────────── */
const ZoneInput = z.object({
  id: uuid.optional(), name: z.string().trim().min(2).max(60),
  country: z.string().trim().toUpperCase().regex(/^([A-Z]{2}|\*)$/, "ISO code or *"), state: z.string().trim().max(60).optional().default(""),
  feeNgn: z.coerce.number().int().min(0), feeUsd: z.coerce.number().int().min(0), freeOverNgn: optMoney, freeOverUsd: optMoney,
  eta: z.string().trim().min(2).max(60), position: z.coerce.number().int().min(0).max(999),
});

export async function saveZone(input: z.input<typeof ZoneInput>): Promise<Result> {
  await requireAdmin();
  const parsed = ZoneInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error);
  const { id, ...z0 } = parsed.data;
  const values = { ...z0, state: z0.state || null };
  if (id) await db.update(s.shippingZones).set(values).where(eq(s.shippingZones.id, id));
  else await db.insert(s.shippingZones).values(values);
  return done();
}

export async function deleteZone(id: string): Promise<Result> {
  await requireAdmin();
  if (!uuid.safeParse(id).success) return { ok: false, error: "Invalid zone." };
  const zones = await db.select({ id: s.shippingZones.id, country: s.shippingZones.country }).from(s.shippingZones);
  const target = zones.find((z0) => z0.id === id);
  if (target?.country === "*" && zones.filter((z0) => z0.country === "*").length === 1) return { ok: false, error: "Keep at least one rest-of-world (*) zone." };
  await db.delete(s.shippingZones).where(eq(s.shippingZones.id, id));
  return done();
}

/* ───────────── Store settings ───────────── */
const SettingsInput = z.object({
  whatsapp: z.union([z.string().trim().regex(/^\+?[0-9]{7,15}$/, "WhatsApp: digits only, with country code (e.g. 2348012345678)"), z.literal("")]),
  announcement: z.string().trim().max(120),
  announcementMobile: z.string().trim().max(60),
}) satisfies z.ZodType<Record<SettingKey, string>>;

export async function saveSettings(input: z.input<typeof SettingsInput>): Promise<Result> {
  await requireAdmin();
  const parsed = SettingsInput.safeParse(input);
  if (!parsed.success) return fail(parsed.error);
  await db.transaction(async (tx) => {
    for (const [key, value] of Object.entries(parsed.data)) {
      await tx.insert(s.settings).values({ key, value }).onConflictDoUpdate({ target: s.settings.key, set: { value, updatedAt: new Date() } });
    }
  });
  updateTag(SETTINGS_TAG);
  refresh();
  return { ok: true };
}

/* ───────────── New-order push notifications ───────────── */
const PushInput = z.object({
  endpoint: z.string().max(1000).refine(isPushEndpoint, "Unsupported push service"),
  keys: z.object({ p256dh: z.string().regex(/^[A-Za-z0-9_-]{80,100}$/), auth: z.string().regex(/^[A-Za-z0-9_-]{16,32}$/) }),
});

export async function savePushSubscription(input: z.input<typeof PushInput>): Promise<Result> {
  const session = await requireAdmin();
  if (!pushEnabled()) return { ok: false, error: "Push notifications aren’t configured on the server." };
  const parsed = PushInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "This browser’s push subscription isn’t supported." };
  if (!(await throttle("push-sub", 20, 3600, session.user.id))) return { ok: false, error: "Too many attempts. Try again later." };
  const { endpoint, keys } = parsed.data;
  await db.insert(s.pushSubscriptions).values({ endpoint, userId: session.user.id, ...keys })
    .onConflictDoUpdate({ target: s.pushSubscriptions.endpoint, set: { userId: session.user.id, ...keys } });
  return { ok: true };
}

export async function removePushSubscription(endpoint: string): Promise<Result> {
  const session = await requireAdmin();
  await db.delete(s.pushSubscriptions).where(and(eq(s.pushSubscriptions.endpoint, String(endpoint).slice(0, 1000)), eq(s.pushSubscriptions.userId, session.user.id)));
  return { ok: true };
}

export async function sendTestPush(): Promise<Result> {
  const session = await requireAdmin();
  if (!(await throttle("push-test", 10, 3600, session.user.id))) return { ok: false, error: "Too many test notifications. Try again later." };
  await pushToAdmin({ title: "Melaré notifications are on", body: "You’ll get an alert here for every new paid order.", url: "/admin" });
  return { ok: true };
}

class AdminError extends Error {}

export async function suggestSlug(name: string) {
  await requireAdmin();
  return slugify(String(name).slice(0, 80));
}
