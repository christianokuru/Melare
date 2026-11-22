# Melaré — Architecture

Mobile-first PWA skincare store. One Next.js app on Vercel (UI + API).

## Stack
| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Cache Components, `proxy.ts`) on Vercel |
| UI | Tailwind v4 + shadcn (Base UI) |
| Auth | Better Auth (email/password, Google, `admin` plugin for roles) |
| DB | Neon Postgres + Drizzle ORM (`neon-http` driver) |
| Media | Cloudflare R2 (S3 API, presigned uploads, custom-domain CDN) |
| Payments | Flutterwave only (NGN + USD) |
| Email | Resend (order confirmations, auth emails) |

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
      uploads/             # POST presigned R2 URL (admin)
      checkout/            # POST create order + init payment
      webhooks/flutterwave/
    manifest.ts  offline/
  components/ui/       # shadcn
  db/schema.ts  db/index.ts
  lib/auth.ts  lib/auth-client.ts  lib/r2.ts  lib/payments/
  proxy.ts             # optimistic redirect for /account, /admin, /checkout
```

## Data model (src/db/schema.ts)
- **Auth:** `user` (role, phone), `session`, `account`, `verification`
- **Catalog:** `categories` → `products` (skinTypes[], concerns[], status) → `product_variants` (sku, size, `price_ngn`, `price_usd`, stock) + `product_images` (R2 keys)
- **Customer:** `addresses`, `carts` / `cart_items` (guest carts via cookie id, merged on sign-in), `wishlist`, `reviews` (moderated)
- **Commerce:** `coupons`, `orders` (status enum, currency, totals, address snapshot), `order_items` (price snapshot), `payments` (provider, unique `reference`, raw payload)

Money = integer minor units (kobo/cents). Never floats.

## Reads vs writes
- **Reads** (catalog, PDP, categories): Server Components + `"use cache"` with `cacheTag("products")`; `revalidateTag` on admin edits.
- **Writes** (cart, address, review, admin CRUD): Server Actions validated with Zod.
- **Route handlers** only where an external caller or the browser needs JSON: auth, uploads, checkout init, webhooks.

## APIs
| Method | Route | Purpose | Auth |
|---|---|---|---|
| * | `/api/auth/*` | Better Auth (sign in/up, OAuth, session, admin) | — |
| POST | `/api/uploads` | Presigned R2 PUT URL `{ uploadUrl, key, url }` | admin |
| POST | `/api/checkout` | Validate cart → create `pending` order → init payment → return redirect URL | user/guest |
| GET | `/api/checkout/verify?ref=` | Verify payment after redirect (fallback to webhook) | — |
| POST | `/api/webhooks/flutterwave` | Verify `verif-hash` → re-verify tx → mark paid → decrement stock (idempotent on `reference`) | signature |

Server Actions: `addToCart`, `updateCartItem`, `removeCartItem`, `toggleWishlist`, `saveAddress`, `submitReview`, `applyCoupon`, admin `upsertProduct`, `updateOrderStatus`, etc.

## Checkout flow
1. Currency: customer toggles ₦ NGN / $ USD (`CurrencySwitcher` → `currency` cookie). First visit defaults from `x-vercel-ip-country` (NG → NGN, else USD). Each variant has its own `price_ngn` and `price_usd`, no FX conversion.
2. `POST /api/checkout` recomputes prices server-side in the chosen currency (never trust client), writes `orders` + `order_items` + `payments` in one `db.batch`.
3. `initPayment()` → redirect to Flutterwave hosted checkout (card, bank transfer, USSD for NGN; card for USD).
4. Redirect back to `/checkout/complete?transaction_id=` → `verifyTransaction()`; webhook does the same as backup. Order `paid`, stock decremented, email via Resend.

## R2 media
- Public reads via a **subdomain of the store's domain** (e.g. `cdn.melare.com`). No extra domain needed, but the domain's DNS must be on Cloudflare (Vercel still hosts the site). During development use the bucket's `r2.dev` URL (rate-limited, not for production).
- Admin uploads go browser → R2 directly via presigned PUT (avoids Vercel 4.5 MB body limit).
- DB stores only the object **key**; `publicUrl(key)` builds the URL; `next/image` optimises it (`remotePatterns` set from `NEXT_PUBLIC_R2_PUBLIC_URL`).
- Configure bucket CORS to allow `PUT` from your app origins.

## PWA
`app/manifest.ts`, icons in `/public`, `public/sw.js` (cache static, offline fallback `/offline`), `experimental.useOffline` for retrying navigations/actions when the network drops.

## Setup
```bash
cp .env.example .env.local   # fill values
npx drizzle-kit push         # create tables on Neon
npm run dev
```
