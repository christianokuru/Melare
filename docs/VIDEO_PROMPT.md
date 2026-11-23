# Showcase Video Prompt (Kylva)

Paste this into Claude Code (or any coding agent) on a finished project, then fill in the **Project inputs** at the bottom.
Reference implementation: `scripts/record-video.js` (Melaré).

---

## Role

You are a senior motion designer and front-end engineer. You produce a **portfolio showcase video** of a website we built,
recorded from the **real, running site** (no mockups, no stock UI), ready to post on **TikTok, Instagram Reels, X and LinkedIn**,
plus a caption for each platform. Short responses, test everything, show me contact sheets before calling it done.

## Outputs

1. `<brand>-vertical-long.mp4`: 1080×1920, 30fps, H.264 + AAC, 60–110s (TikTok, Reels, X)
2. `<brand>-landscape-long.mp4`: 1920×1080, 30fps, H.264 + AAC, 60–110s (LinkedIn, X)
3. Optional teasers: the same scenes cut to 20–30s (intro → hero → product → checkout → outro)
4. Captions for all 4 platforms (see Captions)

## How to record (non-negotiable)

- Run a **production build** (`npm run build && npx next start -p 3100`), never `next dev` (no dev overlay, real speed).
- Playwright + **CDP `Page.startScreencast`** (JPEG quality 92) for crisp frames. Do NOT use Playwright `recordVideo` (blurry, low bitrate).
  - Vertical: viewport 432×768 @ deviceScaleFactor 2.5, `isMobile`, `hasTouch` (it's a mobile-first PWA: show it on a phone).
  - Landscape: viewport 1280×720 @ deviceScaleFactor 1.5.
  - Locale/timezone of the target market (e.g. `en-NG`, `Africa/Lagos`) so currency, country and delivery default correctly.
- **Scene-based**: record each scene separately, encode each to MP4 at a constant 30fps (ffmpeg concat demuxer using frame timestamps),
  then join with **crossfades** (`xfade=transition=fade:duration=0.7`). Page loads are never recorded: navigate with recording off,
  wait for `load` + fonts + a short settle, then record.
- Pre-visit every page once so images are cached (no blank image boxes on camera).
- Pre-set state that must not appear: cookie consent decided in `localStorage`, no dev tools, no toasts from earlier runs.
- Never submit real orders, sign-ups or forms that write to the DB or send email. For results pages, navigate to the result URL directly.
- Use obviously fake demo data only (e.g. `Ada Obi`, `ada.obi@example.com`, a generic street).

## Motion & style

- **Smooth scrolling**: in-page `requestAnimationFrame` scroll with easeInOutCubic, 1.6–3.2s per move, then a 1–2s hold so viewers can read.
  Scroll to **section headings** (find by text), not fixed pixel values, and never scroll into the footer unless it's the point.
- **Transitions**: 0.7s crossfade between scenes. No spins, wipes or zooms.
- **Labels**: one floating pill per moment, bottom-centre, brand dark background, light text, 1 line + optional small sub-line,
  fade/slide in over 0.5s, swap with a short fade. `pointer-events:none`. Max ~6 words. They explain the **benefit**, not the UI.
- **Intro card** (3–4s): brand colour background, "<Agency> presents", brand name in the heading font, tagline, one-line description.
  Elements stagger in (0 / 0.35 / 0.7 / 1.05s).
- **Outro card** (4s): dark brand background, brand name, stack line (e.g. "Next.js · Tailwind · Flutterwave · PWA"),
  "Designed & built by Kylva", CTA "Need a store like this? Let's talk."
- Use the site's own fonts and colours in the cards so the whole video feels like one brand.

## Scene plan (e-commerce default; adapt to the project)

| # | Scene | What to show | Label(s) | ~sec |
|---|-------|--------------|----------|------|
| 1 | Intro | Brand card | none | 3.5 |
| 2 | Home | Hero hold → concerns/categories → product tabs → bundles → reviews/ingredients → quiz/journal → smooth scroll back to top | "Mobile-first & installable / A PWA that feels like an app", "Shop by skin concern", "Bestsellers, new in & under ₦20k", "Curated bundles that save more", "Real reviews & ingredient stories" | 22–25 |
| 3 | Menu (vertical only) | Open mobile menu, hold, close | "Clean, simple navigation" | 3 |
| 4 | Shop | Grid + filters, slow scroll | "Browse the full range / Filter by category & concern" | 7 |
| 5 | Product | Hero image → details → toggle currency ₦→$→₦ → Add to bag (toast) → ingredients/reviews | "Beautiful product pages", "Prices in ₦ or $, your choice", "Add to bag in one tap" | 17 |
| 6 | Bundle | Bundle page with savings | "Bundles with built-in savings" | 7 |
| 7 | Quiz | Tap through answers (~0.9s apart) | "2-minute skin quiz" | 7 |
| 8 | Results | Routine steps (direct URL, no submit) | "A personal routine, step by step" | 7 |
| 9 | Bag | Bag with free-delivery progress | "A clear, honest bag / Free Lagos delivery over ₦50k" | 6 |
| 10 | Checkout | Type email, name, address, city (55ms/char), pick state, scroll to summary + pay button | "Fast checkout", "Smart Nigerian delivery", "Pay in ₦ or $ with Flutterwave / Card · Transfer · USSD" | 17 |
| 11 | Journal | Articles grid | "A journal that builds trust & SEO" | 7 |
| 12 | Outro | Agency card + CTA | none | 4 |

Optional when relevant: admin dashboard (only with a demo account and fake data), order tracking, PWA install prompt, dark mode.

## Music

- **Happy, relaxing, light** (lo-fi / soft acoustic / light electronic, 85–100 BPM, no vocals).
- Only use music we can legally post. Prefer **no-attribution** licences; otherwise CC BY with the credit in every caption.
  Melaré used "Wallpaper" by Kevin MacLeod (incompetech.com), CC BY 4.0 → credit:
  `Music: "Wallpaper" by Kevin MacLeod (incompetech.com), CC BY 4.0`
- Never use commercial/trending songs in the file itself. On TikTok/Instagram you may mute ours and add a trending in-app sound (better reach).
- Mix: trim to video length, 1.5s fade-in, 3s fade-out, volume ~0.85, AAC 192k.

## Platform specs

| Platform | File | Length | Notes |
|----------|------|--------|-------|
| TikTok | Vertical | 60–110s (teaser 20–30s does best) | Hook in the first 2s; add trending sound in-app; keep labels away from the bottom 15% / right edge (UI overlays) |
| Instagram Reels | Vertical | ≤ 3 min | Pick the intro tagline frame as cover; 3–5 hashtags work better than 30 |
| X (Twitter) | Vertical or landscape | ≤ 2:20 (free accounts) | Muted autoplay: labels must tell the story alone |
| LinkedIn | Landscape (or vertical) | ≤ 10 min, 60–110s ideal | Professional tone; upload natively (no YouTube link) |

Encoding: `libx264 -preset slow -crf 18 -pix_fmt yuv420p -r 30 -movflags +faststart`, AAC 192k.

## Captions (write all four)

- **Instagram**: hook line + emoji → 1-line what we built → 4 arrow bullets (features) → CTA ("DM us / link in bio") → 6–10 hashtags.
- **TikTok**: 1–2 lines, POV/hook style, casual, CTA "link in bio", 4–5 hashtags.
- **X**: "New build: <brand>" → 4 short bullets → stack line → link. Max 280 chars, 0–2 hashtags.
- **LinkedIn**: what we shipped + who for → the brief (1 line) → "What we built" bullets (features + security/performance) →
  stack → CTA "let's talk" → link → 3–5 hashtags. No hype words.
- Add the music credit line when the licence requires it. Replace `[link]` with the live URL.

## QA before delivering (show me)

- Contact sheet per video (`ffmpeg -vf "fps=1/2.5,scale=...,tile=..."`), checked for: blank/loading frames, wrong currency or country,
  cookie banner, error toasts, scrolling into the footer by mistake, labels covering key UI, misclicks (e.g. hitting the currency toggle
  instead of a quiz option: scope selectors to `main`), stuck scenes (a timed-out click = a long frozen scene: use short timeouts).
- Per-scene durations listed; total within target.
- Audio present, fades in and out, no clipping.
- Files open on a phone; size under ~50MB.
- Delete any demo rows created during recording; stop the server.

## Pitfalls we hit (Melaré)

- `networkidle` can hang on a page: use `load` + `waitForLoadState("networkidle", { timeout: 8000 }).catch()`.
- Generic selectors like `button[aria-pressed=false]` hit header controls (currency toggle). Scope to `main` and match by text.
- Desktop step changes can jump the page: `scrollTo(0,0)` after each quiz tap.
- Native `<select>`: target by `id` (`#state`) with a short timeout. A failed `getByLabel` waited 30s and froze the scene.
- Recording page loads made a 70s video out of 25s of content: scene-based recording + crossfades fixed it.
- Screencast only sends frames on change: inject a 1px element at scene start/end so every scene has a first and last frame.

---

## Project inputs (fill in)

- Brand / tagline / one-line description:
- Agency name for intro/outro: Kylva
- Production URL or local port:
- Market (locale, timezone, currency):
- Pages and key flows to show (in order):
- Selling points to label (6–10, benefit-first):
- Music track + licence (+ credit line):
- Platforms + target lengths:
- Live link for captions:
