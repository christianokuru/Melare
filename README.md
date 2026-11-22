# Melaré

*Skin, but rarer.* Mobile-first PWA skincare store for melanin-rich skin. Next.js 16 · Tailwind v4 · shadcn · Better Auth · Neon/Drizzle · Flutterwave.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the data model, security model and flows.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in values
npm run db:push              # create tables
npm run db:seed              # catalogue, bundles, shipping zones, WELCOME10
npm run dev
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Integration tests (stock reservation, payment settlement, coupons/referrals) against `DATABASE_URL` |
| `npm run lint` / `typecheck` | ESLint / TypeScript |
| `npm run db:push` / `db:seed` | Drizzle schema push / seed |

## Going live checklist

1. Vercel env vars: everything in `.env.example` (production values).
2. `ADMIN_EMAIL` = the owner's email → sign up with it and click the verification link. Only that verified email can open `/admin`.
3. Flutterwave: add the webhook URL `https://your-domain.com/api/webhooks/flutterwave` and the same secret hash as `FLW_WEBHOOK_HASH`.
4. Resend: verify your sending domain, set `EMAIL_FROM`.
5. Google Search Console: submit `https://your-domain.com/sitemap.xml`.
6. Product photos: add WebP files (~1200px, <200 KB) to `public/images/`, push, then reference `/images/<file>.webp` in Admin → Products.

Photos in `public/images` are from Unsplash (Unsplash License).
