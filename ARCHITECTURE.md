# Melaré · Architecture

Mobile-first PWA skincare store. One Next.js 16 app on Vercel (UI + API), Neon Postgres, Flutterwave payments.

## Stack
| Layer | Choice |
|---|---|
| Framework | Next.js 16 App Router, Cache Components + Partial Prefetching, `proxy.ts` |
| UI | Tailwind v4, shadcn (Base UI), Lenis smooth scroll, Cormorant Garamond + Jost |
| Auth | Better Auth: email/password with **required email verification**, optional Google, DB-backed rate limits |
| DB | Neon Postgres + Drizzle ORM (`neon-serverless` WebSocket pool → real transactions and row locks) |
| Payments | Flutterwave Standard (NGN: card/transfer/USSD; USD: card) |
| Email | Resend REST (logs to console when no key) |
| Images | Neon Object Storage (`public_read` bucket `melare-media`), optimised and cached by `next/image` |
| Jobs | Vercel Cron → `/api/cron/daily` |

## Folder structure
```
src/
  app/
    (store)/               storefront with header/footer
      page.tsx             home
      shop/ shop/[category]/ concerns/[slug]/  listings (shared <Listing>)
      products/[slug]/  bundles/ bundles/[slug]/
      cart/ checkout/ checkout/complete/ track/
      quiz/ quiz/results/ journal/ journal/[slug]/
      (auth)/ sign-in sign-up forgot-password reset-password
      (info)/ about faq shipping returns privacy terms contact
      account/             customer dashboard (orders, favourites, addresses, settings, referral)
    admin/                 admin dashboard (orders, products, categories, bundles, coupons, reviews, customers, shipping, subscribers)
    actions/               server actions: cart, checkout, store, account, admin
    api/auth/[...all]      Better Auth
    api/webhooks/flutterwave
    api/cron/daily
    sitemap.ts robots.ts manifest.ts opengraph-image.tsx
  lib/
    auth.ts                Better Auth config, getSession, isAdmin, requireUser, requireAdmin
    catalog.ts             cached ("use cache" + tag "catalog") catalogue reads
    cart.ts                cart resolution (cookie/user, merge), DB-priced cart lines
    checkout.ts            coupon/referral validation, shipping zones, stock reserve/release, expiry
    payments.ts            Flutterwave link/verify, webhook check, settlePayment()
    throttle.ts            Postgres fixed-window rate limiter for server actions
    storage.ts             Neon Object Storage: validate → strip metadata → resize → WebP → upload
    media.ts               bucket URL helpers + strict URL validation
    email.ts money.ts constants.ts request.ts
  db/schema.ts db/index.ts
  content/journal.ts       SEO articles
scripts/seed.ts  scripts/migrate-images.ts  tests/payments.test.ts  tests/storage.test.ts
```

## Data model
- **Auth:** `user` (phone, referral_code), `session`, `account`, `verification`, `rate_limit`
- **Catalogue:** `categories` → `products` (benefits, ingredients, skin_types[], concerns[], status, days_supply, SEO fields) → `product_variants` (sku, label, price_ngn, price_usd, compare_at_*, stock ≥ 0) + `product_images` (src = bucket URL, alt)
- **Bundles:** `bundles` (discount 1–50%) + `bundle_items` (variant, qty). Price = component sum − discount.
- **Customer:** `addresses` (≤10), `carts`/`cart_items` (variant XOR bundle, qty 1–10), `wishlist`, `reviews` (verified buyers, moderated), `subscribers`, `stock_alerts`, `quiz_results`
- **Commerce:** `shipping_zones`, `coupons` (percent XOR fixed NGN+USD, min subtotal, max uses, expiry, personal `user_id`, influencer `owner_name`), `orders` (random `MLR-XXXXXXXX` number, address snapshot, `stock_reserved`, `expires_at`), `order_items` (price snapshot + reserved `stock` jsonb), `payments` (unique `reference`, unique `transaction_id`)
- **Ops:** `order_events` (order timeline), `push_subscriptions` (admin devices), `settings` (WhatsApp number, banner text)
- **Infra:** `throttle` (rate limits)

Money is always integer minor units (kobo/cents). DB check constraints enforce non-negative stock, positive prices/totals, valid quantities and coupon shape.

## Security model (server-enforced, never the frontend)
- **Single admin:** `isAdmin()` = session email equals `ADMIN_EMAIL` **and** `emailVerified`. No role column a client can write. Every admin page, server action and route calls `requireAdmin()` (non-admins get a 404). Proxy also 404s `/admin` for guests.
- **Customers:** every account page/action derives the user from the session and scopes queries by `user_id` in SQL (no IDOR). Guest orders are visible only with order number + checkout email (rate limited), or via the unguessable payment reference.
- **Prices:** computed only on the server from the DB (cart, quote, order). Client sends ids/quantities only.
- **Checkout:** single transaction validates the code, computes totals, atomically reserves stock (`UPDATE … WHERE stock >= qty`, fixed lock order), writes order + items + payment. Payment window 60 min; stale orders are expired and stock returned (on every checkout + daily cron).
- **Payments:** redirect query params are ignored; we verify server-to-server by **our** `tx_ref`. `settlePayment()` locks the payment and order rows and marks paid only if status = successful **and** currency and exact amount match the order. It's idempotent (repeat webhooks/redirects are no-ops) and handles late payments after expiry (re-reserves stock or flags for refund), duplicate payments (flags for refund) and mismatches (never paid, admin alerted). Webhook requires a constant-time `verif-hash` match.
- **Auth:** email verification required (stops admin-email squatting), password 8–128, session revocation on reset/password change, DB-backed rate limits on sign-in/up/reset, open-redirect-safe `next` param.
- **Abuse:** Postgres rate limits on cart, checkout, quotes/codes, order lookup, reviews, newsletter, quiz, stock alerts. Coupons once per email; referral codes first order only, never self.
- **Inputs:** Zod on every action; LIKE wildcards escaped; JSON-LD `<` escaped; CSV export neutralises formula injection; image URLs must point into our own bucket with a safe key.
- **Uploads (admin only):** server action → `requireAdmin` + rate limit → bytes decoded with sharp (non-images rejected, ≥400px, ≤4 MB) → EXIF/GPS stripped → resized ≤1800px → WebP → random key in `products|categories|bundles/`. Browsers never get storage credentials.
- **Headers:** CSP (frame-ancestors none, object-src none), HSTS (https), X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy; `poweredByHeader` off. Service worker never caches API/account/admin/checkout/cart.

## Reads vs writes
- Catalogue reads: `"use cache"` + `cacheTag("catalog")` + `cacheLife("hours")`, part of the static shell. Admin mutations call `updateTag("catalog")`; paid webhooks `revalidateTag`.
- Request-specific UI (currency, bag count, session) streams inside `<Suspense>`.
- Writes: server actions only (built-in origin checks); route handlers only for Better Auth, the Flutterwave webhook, cron and the CSV export.

## Images
- Bucket `melare-media` (public_read) on the project's main branch; folders `site/` (design photos), `products/`, `categories/`, `bundles/`.
- DB stores full URLs; `next/image` optimises them (AVIF/WebP, 30-day cache), so the bucket serves each image rarely.
- Objects use unique keys with `Cache-Control: immutable`. Removing an image from a product doesn't delete the object (safe if reused); old uploads can be pruned from the Neon Console.

## Payment flow
1. Shopper picks ₦/$ (cookie; defaults by `x-vercel-ip-country`).
2. `placeOrder` → transaction (above) → Flutterwave hosted link (60-min session) → redirect. If Flutterwave is unreachable, the order is cancelled and stock released immediately.
3. Return to `/checkout/complete?tx_ref=…` → verify by reference → `settlePayment`. Webhook does the same in the background.
4. On paid: coupon redemption +1, referral reward coupon for the referrer, cart cleared, customer + admin emails.
5. Admin moves orders through `paid → processing → shipped (tracking required) → delivered`, or `cancelled/refunded` (restock); the customer is emailed at each step. Refunds are issued in the Flutterwave dashboard.

## Selling features
WhatsApp chat (wa.me, free) · shop by concern · routine bundles · delivery estimates + free-delivery progress bar · guest checkout · sticky mobile add-to-bag · low-stock and back-in-stock alerts · verified-buyer reviews with skin type · skin quiz with email capture · WELCOME10 newsletter code · referral programme (₦2,000/$3 both sides) · influencer coupon attribution with revenue · abandoned-bag emails (≤2) · reorder reminders (`days_supply`) · GA4 + Meta Pixel ecommerce events (`view_item`, `add_to_cart`, `begin_checkout`, `purchase` once per order) · PWA install + offline page.

## SEO
Per-page metadata + canonicals, Product (NGN + USD offers, rating), BreadcrumbList, Organization/WebSite (SearchAction), Article, FAQPage JSON-LD; `sitemap.xml`, `robots.txt`, OG image; real 404s for crawlers; semantic HTML, fast LCP (priority hero, AVIF/WebP, static shells); keyword-targeted copy for Nigeria/Lagos and melanin-rich skin; journal articles.

## Dashboards
- **Admin:** date-range stats (revenue NGN/USD, orders, average order, to ship, customers), daily sales chart, best sellers, low stock; sidebar badges (to ship, reviews); orders search (number/name/email/phone), status tabs with counts, date filter, CSV export, bulk "preparing"/"delivered"; order timeline, call/WhatsApp/email, printable packing slip; products search/filter, inline stock edit (restock alerts fire), duplicate, drag-to-reorder images; customer profile page; abandoned bags; store settings; Web Push new-order alerts (VAPID, endpoints restricted to browser push services).
- **Customer:** order tracker with dates, buy again, running-low reorders (`days_supply`), review prompts, rewards wallet + referral stats/sharing, skin profile from the quiz, marketing opt-in, data export (JSON) and account deletion (password, orders kept unlinked), mobile bottom tab bar.

## Tests
`npm test` runs integration tests against the database: concurrent stock reservation (no oversell), idempotent settlement, amount/currency mismatch, failed payments, expiry + late payment, duplicate payment, coupon rules and referral rules.
