import {
  pgTable, pgEnum, text, timestamp, boolean, integer, bigint, jsonb, uniqueIndex, index, primaryKey, check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = timestamp("updated_at", { withTimezone: true }).defaultNow().$onUpdate(() => new Date()).notNull();
const ts = (name: string) => timestamp(name, { withTimezone: true });

/* ───────────── Better Auth ───────────── */
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  phone: text("phone"),
  referralCode: text("referral_code").unique(),
  createdAt, updatedAt,
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  expiresAt: ts("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt, updatedAt,
}, (t) => [index("session_user_idx").on(t.userId)]);

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: ts("access_token_expires_at"),
  refreshTokenExpiresAt: ts("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt, updatedAt,
}, (t) => [index("account_user_idx").on(t.userId)]);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: ts("expires_at").notNull(),
  createdAt, updatedAt,
}, (t) => [index("verification_identifier_idx").on(t.identifier)]);

// Better Auth database-backed rate limiting (works across serverless instances)
export const rateLimit = pgTable("rate_limit", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  count: integer("count").notNull(),
  lastRequest: bigint("last_request", { mode: "number" }).notNull(),
});

/* ───────────── App rate limiting (server actions) ───────────── */
export const throttle = pgTable("throttle", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  resetAt: ts("reset_at").notNull(),
});

/* ───────────── Catalog ───────────── */
export const productStatus = pgEnum("product_status", ["draft", "active", "archived"]);

export const categories = pgTable("categories", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  image: text("image"),
  position: integer("position").default(0).notNull(),
  createdAt, updatedAt,
});

export const products = pgTable("products", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tagline: text("tagline").notNull(),
  description: text("description").notNull(),
  benefits: text("benefits").array().default(sql`'{}'::text[]`).notNull(),
  ingredients: text("ingredients"),
  howToUse: text("how_to_use"),
  skinTypes: text("skin_types").array().default(sql`'{}'::text[]`).notNull(),
  concerns: text("concerns").array().default(sql`'{}'::text[]`).notNull(),
  categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
  status: productStatus("status").default("draft").notNull(),
  featured: boolean("featured").default(false).notNull(),
  daysSupply: integer("days_supply"),
  seoTitle: text("seo_title"),
  seoDescription: text("seo_description"),
  createdAt, updatedAt,
}, (t) => [index("products_category_idx").on(t.categoryId), index("products_status_idx").on(t.status)]);

export const productVariants = pgTable("product_variants", {
  id: id(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  sku: text("sku").notNull().unique(),
  label: text("label").notNull(),
  priceNgn: integer("price_ngn").notNull(),
  priceUsd: integer("price_usd").notNull(),
  compareAtNgn: integer("compare_at_ngn"),
  compareAtUsd: integer("compare_at_usd"),
  stock: integer("stock").default(0).notNull(),
  position: integer("position").default(0).notNull(),
  createdAt, updatedAt,
}, (t) => [
  index("variants_product_idx").on(t.productId),
  check("variant_stock_nonneg", sql`${t.stock} >= 0`),
  check("variant_price_pos", sql`${t.priceNgn} > 0 and ${t.priceUsd} > 0`),
]);

export const productImages = pgTable("product_images", {
  id: id(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  src: text("src").notNull(),
  alt: text("alt").notNull(),
  position: integer("position").default(0).notNull(),
  createdAt,
}, (t) => [index("images_product_idx").on(t.productId)]);

export const bundles = pgTable("bundles", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tagline: text("tagline").notNull(),
  description: text("description").notNull(),
  image: text("image").notNull(),
  discountPercent: integer("discount_percent").notNull(),
  active: boolean("active").default(true).notNull(),
  createdAt, updatedAt,
}, (t) => [check("bundle_discount_range", sql`${t.discountPercent} between 1 and 50`)]);

export const bundleItems = pgTable("bundle_items", {
  bundleId: text("bundle_id").notNull().references(() => bundles.id, { onDelete: "cascade" }),
  variantId: text("variant_id").notNull().references(() => productVariants.id, { onDelete: "cascade" }),
  quantity: integer("quantity").default(1).notNull(),
}, (t) => [primaryKey({ columns: [t.bundleId, t.variantId] })]);

/* ───────────── Customer ───────────── */
export const addresses = pgTable("addresses", {
  id: id(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  fullName: text("full_name").notNull(),
  phone: text("phone").notNull(),
  line1: text("line1").notNull(),
  line2: text("line2"),
  city: text("city").notNull(),
  state: text("state").notNull(),
  country: text("country").notNull(),
  postalCode: text("postal_code"),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt, updatedAt,
}, (t) => [index("addresses_user_idx").on(t.userId)]);

export const carts = pgTable("carts", {
  id: id(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }),
  email: text("email"),
  remindersSent: integer("reminders_sent").default(0).notNull(),
  lastRemindedAt: ts("last_reminded_at"),
  createdAt, updatedAt,
}, (t) => [index("carts_user_idx").on(t.userId)]);

export const cartItems = pgTable("cart_items", {
  id: id(),
  cartId: text("cart_id").notNull().references(() => carts.id, { onDelete: "cascade" }),
  variantId: text("variant_id").references(() => productVariants.id, { onDelete: "cascade" }),
  bundleId: text("bundle_id").references(() => bundles.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
  createdAt,
}, (t) => [
  uniqueIndex("cart_variant_uq").on(t.cartId, t.variantId),
  uniqueIndex("cart_bundle_uq").on(t.cartId, t.bundleId),
  check("cart_item_one_ref", sql`(${t.variantId} is null) <> (${t.bundleId} is null)`),
  check("cart_item_qty", sql`${t.quantity} between 1 and 10`),
]);

export const wishlist = pgTable("wishlist", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  createdAt,
}, (t) => [primaryKey({ columns: [t.userId, t.productId] })]);

export const reviews = pgTable("reviews", {
  id: id(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  authorName: text("author_name").notNull(),
  rating: integer("rating").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  skinType: text("skin_type").notNull(),
  approved: boolean("approved").default(false).notNull(),
  createdAt, updatedAt,
}, (t) => [
  uniqueIndex("review_user_product_uq").on(t.userId, t.productId),
  check("review_rating_range", sql`${t.rating} between 1 and 5`),
]);

export const subscribers = pgTable("subscribers", {
  email: text("email").primaryKey(),
  source: text("source").notNull(),
  createdAt,
});

export const stockAlerts = pgTable("stock_alerts", {
  email: text("email").notNull(),
  variantId: text("variant_id").notNull().references(() => productVariants.id, { onDelete: "cascade" }),
  createdAt,
}, (t) => [primaryKey({ columns: [t.email, t.variantId] })]);

export const quizResults = pgTable("quiz_results", {
  id: id(),
  email: text("email"),
  answers: jsonb("answers").notNull(),
  productIds: text("product_ids").array().notNull(),
  createdAt,
});

/* ───────────── Shipping ───────────── */
export const shippingZones = pgTable("shipping_zones", {
  id: id(),
  name: text("name").notNull(),
  country: text("country").notNull(), // ISO alpha-2 or "*" for rest of world
  state: text("state"), // optional state match (e.g. Lagos)
  feeNgn: integer("fee_ngn").notNull(),
  feeUsd: integer("fee_usd").notNull(),
  freeOverNgn: integer("free_over_ngn"),
  freeOverUsd: integer("free_over_usd"),
  eta: text("eta").notNull(),
  position: integer("position").default(0).notNull(),
  createdAt, updatedAt,
});

/* ───────────── Orders & payments ───────────── */
export const orderStatus = pgEnum("order_status", [
  "pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded",
]);
export const paymentStatus = pgEnum("payment_status", ["initiated", "success", "failed"]);

export const coupons = pgTable("coupons", {
  id: id(),
  code: text("code").notNull().unique(), // stored upper-case
  percentOff: integer("percent_off"),
  amountOffNgn: integer("amount_off_ngn"),
  amountOffUsd: integer("amount_off_usd"),
  minSubtotalNgn: integer("min_subtotal_ngn"),
  minSubtotalUsd: integer("min_subtotal_usd"),
  maxRedemptions: integer("max_redemptions"),
  redemptions: integer("redemptions").default(0).notNull(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }), // personal (referral reward)
  ownerName: text("owner_name"), // influencer attribution
  expiresAt: ts("expires_at"),
  active: boolean("active").default(true).notNull(),
  createdAt,
}, (t) => [
  check("coupon_one_kind", sql`(${t.percentOff} is not null) <> (${t.amountOffNgn} is not null and ${t.amountOffUsd} is not null)`),
  check("coupon_percent_range", sql`${t.percentOff} is null or ${t.percentOff} between 1 and 90`),
]);

export const orders = pgTable("orders", {
  id: id(),
  number: text("number").notNull().unique(),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  email: text("email").notNull(),
  status: orderStatus("status").default("pending").notNull(),
  currency: text("currency").notNull(),
  subtotal: integer("subtotal").notNull(),
  shippingFee: integer("shipping_fee").notNull(),
  discount: integer("discount").default(0).notNull(),
  total: integer("total").notNull(),
  couponId: text("coupon_id").references(() => coupons.id, { onDelete: "set null" }),
  referrerId: text("referrer_id").references(() => user.id, { onDelete: "set null" }),
  shippingAddress: jsonb("shipping_address").$type<ShippingAddress>().notNull(),
  shippingZone: text("shipping_zone").notNull(),
  cartId: text("cart_id"), // cleared once paid
  stockReserved: boolean("stock_reserved").default(true).notNull(), // order currently holds inventory
  trackingNumber: text("tracking_number"),
  note: text("note"),
  expiresAt: ts("expires_at").notNull(),
  paidAt: ts("paid_at"),
  shippedAt: ts("shipped_at"),
  deliveredAt: ts("delivered_at"),
  createdAt, updatedAt,
}, (t) => [
  index("orders_user_idx").on(t.userId),
  index("orders_status_idx").on(t.status),
  index("orders_email_idx").on(t.email),
  check("order_total_pos", sql`${t.total} > 0`),
]);

export const orderItems = pgTable("order_items", {
  id: id(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: text("product_id").references(() => products.id, { onDelete: "set null" }),
  bundleId: text("bundle_id").references(() => bundles.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  label: text("label").notNull(),
  image: text("image"),
  unitPrice: integer("unit_price").notNull(),
  quantity: integer("quantity").notNull(),
  // variants whose stock this line reserved: [{ variantId, quantity }]
  stock: jsonb("stock").$type<{ variantId: string; quantity: number }[]>().notNull(),
  reminderSentAt: ts("reminder_sent_at"),
}, (t) => [index("order_items_order_idx").on(t.orderId)]);

export const payments = pgTable("payments", {
  id: id(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  reference: text("reference").notNull().unique(), // tx_ref sent to Flutterwave
  transactionId: text("transaction_id").unique(),
  status: paymentStatus("status").default("initiated").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull(),
  raw: jsonb("raw"),
  createdAt, updatedAt,
}, (t) => [index("payments_order_idx").on(t.orderId)]);

export type ShippingAddress = {
  fullName: string; phone: string; line1: string; line2?: string | null;
  city: string; state: string; country: string; postalCode?: string | null;
};
