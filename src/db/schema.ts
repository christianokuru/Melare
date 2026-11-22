import {
  pgTable, pgEnum, text, timestamp, boolean, integer, jsonb, uniqueIndex, index, primaryKey,
} from "drizzle-orm/pg-core";

const id = () => text("id").primaryKey().$defaultFn(() => crypto.randomUUID());
const timestamps = {
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().$onUpdate(() => new Date()).notNull(),
};

/* ───────────── Better Auth (core + admin plugin) ───────────── */
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  phone: text("phone"),
  role: text("role").default("customer"), // customer | admin
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  ...timestamps,
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  impersonatedBy: text("impersonated_by"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  ...timestamps,
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  ...timestamps,
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  ...timestamps,
});

/* ───────────── Catalog ───────────── */
export const productStatus = pgEnum("product_status", ["draft", "active", "archived"]);

export const categories = pgTable("categories", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(), // Cleansers, Serums, Moisturisers, SPF, Body…
  description: text("description"),
  image: text("image"), // path in /public, e.g. /categories/serums.webp
  position: integer("position").default(0).notNull(),
  ...timestamps,
});

export const products = pgTable("products", {
  id: id(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  tagline: text("tagline"),
  description: text("description"),
  ingredients: text("ingredients"),
  howToUse: text("how_to_use"),
  skinTypes: text("skin_types").array().default([]).notNull(), // oily, dry, combination, sensitive
  concerns: text("concerns").array().default([]).notNull(), // hyperpigmentation, acne, dullness…
  categoryId: text("category_id").references(() => categories.id, { onDelete: "set null" }),
  status: productStatus("status").default("draft").notNull(),
  featured: boolean("featured").default(false).notNull(),
  ...timestamps,
}, (t) => [index("products_category_idx").on(t.categoryId), index("products_status_idx").on(t.status)]);

// Each sellable size/variant. Money is stored in minor units (kobo / cents).
export const productVariants = pgTable("product_variants", {
  id: id(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  sku: text("sku").notNull().unique(),
  label: text("label").notNull(), // "30ml", "50ml"
  priceNgn: integer("price_ngn").notNull(),
  priceUsd: integer("price_usd").notNull(),
  compareAtNgn: integer("compare_at_ngn"),
  compareAtUsd: integer("compare_at_usd"),
  stock: integer("stock").default(0).notNull(),
  weightGrams: integer("weight_grams"),
  ...timestamps,
}, (t) => [index("variants_product_idx").on(t.productId)]);

export const productImages = pgTable("product_images", {
  id: id(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  src: text("src").notNull(), // path in /public, e.g. /products/glow-serum/1.webp
  alt: text("alt"),
  position: integer("position").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

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
  country: text("country").default("NG").notNull(), // ISO-3166 alpha-2
  postalCode: text("postal_code"),
  isDefault: boolean("is_default").default(false).notNull(),
  ...timestamps,
});

export const carts = pgTable("carts", {
  id: id(),
  userId: text("user_id").references(() => user.id, { onDelete: "cascade" }), // null = guest (cookie id)
  currency: text("currency").default("NGN").notNull(),
  ...timestamps,
});

export const cartItems = pgTable("cart_items", {
  id: id(),
  cartId: text("cart_id").notNull().references(() => carts.id, { onDelete: "cascade" }),
  variantId: text("variant_id").notNull().references(() => productVariants.id, { onDelete: "cascade" }),
  quantity: integer("quantity").notNull(),
}, (t) => [uniqueIndex("cart_variant_uq").on(t.cartId, t.variantId)]);

export const wishlist = pgTable("wishlist", {
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.productId] })]);

export const reviews = pgTable("reviews", {
  id: id(),
  productId: text("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  rating: integer("rating").notNull(), // 1–5
  title: text("title"),
  body: text("body"),
  approved: boolean("approved").default(false).notNull(),
  ...timestamps,
}, (t) => [uniqueIndex("review_user_product_uq").on(t.userId, t.productId)]);

/* ───────────── Orders & payments ───────────── */
export const orderStatus = pgEnum("order_status", [
  "pending", "paid", "processing", "shipped", "delivered", "cancelled", "refunded",
]);
export const paymentProvider = pgEnum("payment_provider", ["flutterwave"]);
export const paymentStatus = pgEnum("payment_status", ["initiated", "success", "failed", "refunded"]);

export const coupons = pgTable("coupons", {
  id: id(),
  code: text("code").notNull().unique(),
  percentOff: integer("percent_off"),
  amountOffNgn: integer("amount_off_ngn"),
  amountOffUsd: integer("amount_off_usd"),
  maxRedemptions: integer("max_redemptions"),
  redemptions: integer("redemptions").default(0).notNull(),
  expiresAt: timestamp("expires_at"),
  active: boolean("active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const orders = pgTable("orders", {
  id: id(),
  number: text("number").notNull().unique(), // MLR-000123
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  email: text("email").notNull(),
  status: orderStatus("status").default("pending").notNull(),
  currency: text("currency").notNull(), // NGN | USD
  subtotal: integer("subtotal").notNull(),
  shippingFee: integer("shipping_fee").default(0).notNull(),
  discount: integer("discount").default(0).notNull(),
  total: integer("total").notNull(),
  couponId: text("coupon_id").references(() => coupons.id),
  shippingAddress: jsonb("shipping_address").notNull(), // snapshot
  trackingNumber: text("tracking_number"),
  ...timestamps,
}, (t) => [index("orders_user_idx").on(t.userId), index("orders_status_idx").on(t.status)]);

export const orderItems = pgTable("order_items", {
  id: id(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  variantId: text("variant_id").references(() => productVariants.id, { onDelete: "set null" }),
  productName: text("product_name").notNull(), // snapshot
  variantLabel: text("variant_label").notNull(),
  unitPrice: integer("unit_price").notNull(),
  quantity: integer("quantity").notNull(),
});

export const payments = pgTable("payments", {
  id: id(),
  orderId: text("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  provider: paymentProvider("provider").default("flutterwave").notNull(),
  reference: text("reference").notNull().unique(), // our tx_ref, idempotency key for webhooks
  flwTransactionId: text("flw_transaction_id"),
  status: paymentStatus("status").default("initiated").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull(),
  raw: jsonb("raw"), // last provider payload
  ...timestamps,
});
