# Melaré — Architecture

Mobile-first PWA skincare store. One Next.js app on Vercel (UI + API).

## Stack
| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Cache Components, `proxy.ts`) on Vercel |
| UI | Tailwind v4 + shadcn (Base UI) |
| Auth | Better Auth (email/password, Google, `admin` plugin for roles) |
| DB | Neon Postgres + Drizzle ORM (`neon-http` driver) |
| Media | Images in `/public`, served by Vercel's CDN, optimised by `next/image` |
| Payments | Flutterwave only (NGN + USD) |
| Email | Resend free tier (order confirmations, auth, abandoned-cart, reorder reminders) |

## Folder structure
```
src/
  app/
    (shop)/            # public storefront: /, /shop, /shop/[category], /p/[slug], /cart
    (auth)/            # /sign-in, /sign-up, /forgot-password
    account/           # orders, addresses, wishlist  (auth required)
    checkout/          # address → shipping → pay      (auth or guest email)
    admin/             # products, orders, customers, coupons (role=admin)
    api/
      auth/[...all]/       # Better Auth handler
      checkout/            # POST create order + init payment
      webhooks/flutterwave/
    manifest.ts  offline/
  components/ui/       # shadcn
  db/schema.ts  db/index.ts
  lib/auth.ts  lib/auth-client.ts  lib/payments/
  proxy.ts             # optimistic redirect for /account, /admin, /checkout
```

## Data model (src/db/schema.ts)
- **Auth:** `user` (role, phone), `session`, `account`, `verification`
- **Catalog:** `categories` → `products` (skinTypes[], concerns[], status) → `product_variants` (sku, size, `price_ngn`, `price_usd`, stock) + `product_images` (`src` = path in `/public`)
- **Customer:** `addresses`, `carts` / `cart_items` (guest carts via cookie id, merged on sign-in), `wishlist`, `reviews` (moderated)
- **Commerce:** `coupons`, `orders` (status enum, currency, totals, address snapshot), `order_items` (price snapshot), `payments` (provider, unique `reference`, raw payload)

Money = integer minor units (kobo/cents). Never floats.

## Reads vs writes
- **Reads** (catalog, PDP, categories): Server Components + `"use cache"` with `cacheTag("products")`; `revalidateTag` on admin edits.
- **Writes** (cart, address, review, admin CRUD): Server Actions validated with Zod.
- **Route handlers** only where an external caller or the browser needs JSON: auth, checkout init, webhooks.

## APIs
| Method | Route | Purpose | Auth |
|---|---|---|---|
| * | `/api/auth/*` | Better Auth (sign in/up, OAuth, session, admin) | — |
| POST | `/api/checkout` | Validate cart → create `pending` order → init payment → return redirect URL | user/guest |
| GET | `/api/checkout/verify?ref=` | Verify payment after redirect (fallback to webhook) | — |
| POST | `/api/webhooks/flutterwave` | Verify `verif-hash` → re-verify tx → mark paid → decrement stock (idempotent on `reference`) | signature |

Server Actions: `addToCart`, `updateCartItem`, `removeCartItem`, `toggleWishlist`, `saveAddress`, `submitReview`, `applyCoupon`, admin `upsertProduct`, `updateOrderStatus`, etc.

## Checkout flow
1. Currency: customer toggles ₦ NGN / $ USD (`CurrencySwitcher` → `currency` cookie). First visit defaults from `x-vercel-ip-country` (NG → NGN, else USD). Each variant has its own `price_ngn` and `price_usd`, no FX conversion.
2. `POST /api/checkout` recomputes prices server-side in the chosen currency (never trust client), writes `orders` + `order_items` + `payments` in one `db.batch`.
3. `initPayment()` → redirect to Flutterwave hosted checkout (card, bank transfer, USSD for NGN; card for USD).
4. Redirect back to `/checkout/complete?transaction_id=` → `verifyTransaction()`; webhook does the same as backup. Order `paid`, stock decremented, email via Resend.

## Images
- Stored in the repo under `/public`:
  ```
  public/products/<product-slug>/1.webp, 2.webp …
  public/categories/<category-slug>.webp
  public/banners/…
  ```
- DB stores the path (`product_images.src = "/products/glow-serum/1.webp"`); render with `next/image` (auto resize, AVIF/WebP, CDN-cached).
- Export as **WebP, ~1200px wide, < 200 KB** to keep the repo light.
- No uploads at runtime (Vercel's filesystem is read-only). New/changed images = add files → commit → push → Vercel redeploys.
- If the catalogue outgrows the repo or the client needs admin uploads, move to Cloudinary/UploadThing; only `src` values change.

## PWA
`app/manifest.ts`, icons in `/public`, `public/sw.js` (cache static, offline fallback `/offline`), `experimental.useOffline` for retrying navigations/actions when the network drops.

## Conversion features (built to sell, not just look good)

All free to run. Email via Resend's free tier, web push via VAPID, scheduled jobs via Vercel Cron.

### Trust
- **WhatsApp chat button**: floating on every page, free `https://wa.me/<number>?text=` link (no WhatsApp Business API, no cost). Prefilled message includes the product name on PDPs.
- **Reviews with photos + skin-type filter**: `reviews` gains `skin_type` and `photos` (paths). Admin approves before showing. PDP shows average rating and "Most helpful".
- **Delivery estimate by location**: "Lagos 1–2 days · Other states 3–5 · International 7–14", shipping fee shown on PDP and in cart *before* checkout. Config in a `shipping_zones` table (zone, countries/states, fee NGN/USD, ETA).

### Discovery
- **Skin quiz** (`/quiz`): 5–6 questions (skin type, concerns, sensitivity, routine size). Rules map answers → products/bundle. Result page collects email ("Send me my routine"). Table `quiz_results` (email, answers jsonb, recommended product ids).
- **Shop by concern** (`/concern/[slug]`): uses `products.concerns[]`; concern tiles on home page next to category tiles.
- **Routine bundles** (`/bundles/[slug]`): table `bundles` (name, slug, image, discount %) + `bundle_items` (variant, qty). Price = sum of items − discount, shown with "You save ₦X". Added to cart as one line; expands into order items at checkout.

### Mobile checkout
- **Guest checkout**: email + phone first; account optional after purchase ("Save details for next time").
- **Sticky add-to-cart bar** on PDP (mobile).
- **Free-shipping progress bar** in cart drawer and cart page ("₦5,000 away from free delivery"); threshold per currency in `shipping_zones`.
- **Flutterwave**: bank transfer, USSD and card shown up front for NGN; card for USD.
- **Performance budget**: LCP < 2.5s on 4G, WebP images ≤ 200 KB, minimal client JS.

### Retention
- **Abandoned-cart emails**: carts with an email and no order → email at 1h and 24h (second one may include a small coupon). `carts` gains `email`, `reminder_count`, `last_reminded_at`. Vercel Cron hits `/api/cron/abandoned-carts`.
- **Reorder reminders**: `products.days_supply` (e.g. 60). Daily cron finds paid orders where `delivered_at + days_supply − 10 days = today` → "Running low?" email with one-click reorder link.
- **Referrals**: every customer gets a code (`user.referral_code`). Friend gets ₦2,000 / $3 off first order; referrer gets the same as a coupon once the friend's order is paid. Table `referrals` (referrer, referred user, order, status). Reuses `coupons`.
- **PWA install prompt + web push**: prompt after 2nd visit or first purchase. Push for back-in-stock and promos. Table `push_subscriptions` (user, endpoint, keys). "Notify me" on out-of-stock variants → `stock_alerts`.

### Traffic & tracking
- **Product rich results**: JSON-LD `Product` (price in current currency, rating, availability) on every PDP; `Organization` + `BreadcrumbList` site-wide; `sitemap.ts` + `robots.ts`.
- **Blog** (`/journal/[slug]`): MDX posts on melanin skincare, internal links to products/concerns.
- **Influencer codes**: coupons with `owner_name`; admin report of orders and revenue per code.
- **Analytics**: GA4 + Meta Pixel with ecommerce events (`view_item`, `add_to_cart`, `begin_checkout`, `purchase`); purchase fired server-side after payment verification to avoid duplicates.

### Build order
1. WhatsApp button, shop by concern, routine bundles, delivery estimates, guest checkout, sticky ATC, free-shipping bar
2. Abandoned-cart emails, reviews with photos, JSON-LD/sitemap, analytics
3. Skin quiz, referrals, reorder reminders, web push, blog

## Setup
```bash
cp .env.example .env.local   # fill values
npx drizzle-kit push         # create tables on Neon
npm run dev
```
