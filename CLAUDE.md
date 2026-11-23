@AGENTS.md

# Melaré · project memory

Mobile-first PWA skincare store for melanin-rich skin, built by **Kylva** (footer: "Made with love by Kylva").
Owner: Nigerian developer in Lagos. Details: `ARCHITECTURE.md`. Reusable build prompt: `docs/MASTER_PROMPT.md`. Social video prompt: `docs/VIDEO_PROMPT.md`.

## How to work with me
- Short, precise answers; save tokens; use MCP servers only when needed.
- "Don't code" / a plain question → explain only, don't build.
- Clean, DRY code. Test in the browser (Playwright, `:visible` selectors, prod build for visuals). Commit **and push to `main`** when done.
- Think like a sneaky pro hacker on every feature (see "Hacker mode" in the master prompt); security is enforced in the backend.
- Free-licence images only (Unsplash licence, no model-release risk → prefer product shots). Upload to the Neon bucket.

## Stack
Next.js 16.4 (Cache Components, `proxy.ts`; read `node_modules/next/dist/docs/` first) · Tailwind v4 · shadcn (Base UI) ·
Better Auth 1.7 (email verification required) · Neon Postgres + Drizzle (`ws` WebSocket pool, transactions + row locks) ·
Neon Object Storage (bucket `melare-media`, `media()` helper) · **Paystack + Flutterwave** · Resend · web-push v4 (VAPID) · Vitest + Playwright.

## Hard rules (never break)
- Secrets only in env vars / `.env.local` (gitignored). Never commit them, never print them, never ask for them in chat.
- Never write the owner's email into files or send it to outside services. Admin = only the `ADMIN_EMAIL` env var.
- Payments: an order is paid ONLY via `settlePayment(verifyPayment(provider, ourReference))`. Never trust redirect params or webhook bodies.
- Tests must never send real email or real push (setup.ts deletes `RESEND_API_KEY` and `VAPID_PRIVATE_KEY`).

## Done (all pushed to main)
- **Store**: home (half-width product-photo hero, pills, proof line, concern icons, product tabs, bundles, reviews, ingredients, quiz, journal), shop/category/concern listings, product + bundle pages, bag, checkout, order tracking, skin quiz + results, journal, info pages, NGN/USD switcher, cookie consent + GA4/Clarity/Meta (consent-gated, never on private routes).
- **Auth**: split-screen sign-in/up with photo, password reveal, strength meter, inline weak-password errors; admin lands on `/admin`; header shows initials or ADMIN.
- **Customer dashboard**: orders + tracker, buy again, wishlist, addresses, referral rewards, data export, account deletion.
- **Admin dashboard**: full-width, stats + chart, orders (status, tracking number, bulk actions, packing slip, WhatsApp/call/email), products/categories/bundles/coupons/reviews/customers/shipping/subscribers, image upload (WebP), push alerts for new orders.
- **Payments**: `src/lib/gateways.ts` (Paystack first for NGN: card/transfer/USSD/bank; Flutterwave for USD), customer picker at checkout, `payments.provider` column, webhooks `/api/webhooks/paystack` (HMAC-SHA512 raw body) and `/api/webhooks/flutterwave` (verif-hash), callback `/checkout/complete`. Only the Paystack **secret** key is used (redirect flow; public key not needed). Owner tested card + transfer successfully.
- **Orders**: 30-min stock reservation, max 2 open orders, max 20 units, late-payment re-reserve, duplicate/mismatch alerts, shipped/delivered/cancelled/refunded emails with tracking number.
- **Security**: all 19 audit findings fixed (codes need an account + once per person by user/canonical email/phone with advisory locks, referral first-paid-order only, signed email tokens, newsletter double opt-in + one-click unsubscribe + suppressions, safeNext, trusted-IP rate limits, upload route same-origin, SRI, no PII in push, masked email on the confirmation page). CSP keeps `'unsafe-inline'` (strict breaks Next).
- **Reliability**: Neon pool uses `ws`, 10s idle timeout and an error handler; newsletter shows a friendly error if the DB drops.
- **Marketing**: 1:45 showcase videos (vertical + landscape) with captions for IG/TikTok/X/LinkedIn; recorder at `scripts/record-video.js`.
- **Tests**: 47 passing (`npx vitest run`): payments, security, Paystack gateway suite, dashboards. `npm audit` 0.

## Owner's setup checklist (deploy)
Vercel env: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` = `NEXT_PUBLIC_APP_URL` = site URL, `ADMIN_EMAIL`, `PAYSTACK_SECRET_KEY` (sk_live), `PAYSTACK_CURRENCIES=NGN`,
`FLW_SECRET_KEY`, `FLW_WEBHOOK_HASH`, `RESEND_API_KEY`, `EMAIL_FROM`, VAPID keys, storage keys, analytics IDs, `CRON_SECRET`.
Paystack dashboard: callback `https://DOMAIN/checkout/complete`, webhook `https://DOMAIN/api/webhooks/paystack`, enable payment channels.
After pulling schema changes: `npm run db:push`.

## Gotchas learned
- Localhost can't receive webhooks; the confirmation page re-verifies with the gateway, so local payments still settle.
- Flutterwave's test checkout is sometimes blocked by *their* Cloudflare, not our site.
- In `sql` template literals double backslashes (`\\D`). Run `npx next typegen` after adding routes.
- Kill stale servers by port (`fuser -k 3100/tcp`) before browser tests; `next start` leaves `next-server` running.
- Paystack: one login can hold many businesses, each with its own keys + webhook. Flutterwave: one account per business.
