# Melaré

*Skin, but rarer.* Mobile-first PWA skincare store for melanin-rich skin. Next.js 16 · Tailwind v4 · shadcn · Better Auth · Neon/Drizzle · Flutterwave.

See [ARCHITECTURE.md](./ARCHITECTURE.md) for the data model, security model and flows.

## Setup

```bash
npm install
cp .env.example .env.local   # fill in values
npm run db:push              # create tables
npx tsx scripts/migrate-images.ts  # one-off: only if starting from the original repo images
npm run db:seed              # catalogue, bundles, shipping zones, WELCOME10
npm run dev
```

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` / `build` / `start` | Next.js |
| `npm test` | Integration tests (stock reservation, payment settlement, coupons/referrals, image storage) against your Neon project |
| `npm run lint` / `typecheck` | ESLint / TypeScript |
| `npm run db:push` / `db:seed` | Drizzle schema push / seed |

## Going live checklist

1. Vercel env vars: everything in `.env.example` (production values).
2. `ADMIN_EMAIL` = the owner's email → sign up with it and click the verification link. Only that verified email can open `/admin`.
3. Flutterwave: add the webhook URL `https://your-domain.com/api/webhooks/flutterwave` and the same secret hash as `FLW_WEBHOOK_HASH`.
4. Resend: verify your sending domain, set `EMAIL_FROM`.
5. Google Search Console: submit `https://your-domain.com/sitemap.xml`.
6. Product photos: upload them in Admin → Products (JPG/PNG/WebP/AVIF ≤4 MB). They're stored in Neon Object Storage, resized and converted to WebP automatically.

The starter photos (bucket folder `site/`) are from Unsplash (Unsplash License).
