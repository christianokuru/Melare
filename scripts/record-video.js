/* eslint-disable -- standalone Node/Playwright tool script (CommonJS) */
// Showcase video recorder (see docs/VIDEO_PROMPT.md). Needs: npm run build && npx next start -p 3100, ffmpeg, a licensed music.mp3.
// Usage: MUSIC=path/to/track.mp3 node scripts/record-video.js vertical|landscape
const { chromium } = require("playwright");
const fs = require("fs");
const { execSync } = require("child_process");
const MODE = process.argv[2] || "vertical";
const V = MODE === "vertical";
const BASE = process.env.BASE_URL || "http://localhost:3100";
const OUT = process.env.OUT_DIR || require("path").resolve("video-out");
const DIR = `${OUT}/scenes-${MODE}`;
fs.rmSync(DIR, { recursive: true, force: true });
fs.mkdirSync(DIR, { recursive: true });
const [W, H, DSF] = V ? [432, 768, 2.5] : [1280, 720, 1.5];
const [OW, OH] = V ? [1080, 1920] : [1920, 1080];
const FADE = 0.7;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const sh = (c) => execSync(c, { stdio: ["ignore", "pipe", "inherit"] }).toString().trim();

(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: DSF, isMobile: V, hasTouch: V, locale: "en-NG", timezoneId: "Africa/Lagos" });
  await ctx.addInitScript(() => localStorage.setItem("melare-consent", "denied"));
  const p = await ctx.newPage();
  const cdp = await ctx.newCDPSession(p);
  let frames = null;
  cdp.on("Page.screencastFrame", async (f) => {
    if (frames) frames.push({ data: f.data, t: f.metadata.timestamp });
    await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send("Page.startScreencast", { format: "jpeg", quality: 92, maxWidth: W * DSF, maxHeight: H * DSF, everyNthFrame: 1 });

  const scenes = [];
  const nudge = () => p.evaluate(() => { const el = document.createElement("i"); el.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:.01"; document.body.appendChild(el); setTimeout(() => el.remove(), 50); });
  const scene = async (name, fn) => {
    frames = [];
    await nudge();
    await fn();
    await nudge();
    await wait(120);
    const fr = frames; frames = null;
    const d = `${DIR}/${name}`;
    fs.mkdirSync(d);
    const list = [];
    fr.forEach((f, i) => {
      const n = `f${String(i).padStart(5, "0")}.jpg`;
      fs.writeFileSync(`${d}/${n}`, Buffer.from(f.data, "base64"));
      list.push(`file '${n}'`, `duration ${Math.max(i < fr.length - 1 ? fr[i + 1].t - f.t : 0.05, 0.001).toFixed(4)}`);
    });
    list.push(`file 'f${String(fr.length - 1).padStart(5, "0")}.jpg'`);
    fs.writeFileSync(`${d}/list.txt`, list.join("\n"));
    const out = `${DIR}/${String(scenes.length).padStart(2, "0")}-${name}.mp4`;
    sh(`ffmpeg -y -loglevel error -f concat -safe 0 -i ${d}/list.txt -vf "scale=${OW}:${OH}:flags=lanczos,fps=30,format=yuv420p" -c:v libx264 -preset medium -crf 16 -r 30 ${out}`);
    scenes.push(out);
    console.log(name, fr.length, "frames");
  };

  const label = (text, sub = "") =>
    p.evaluate(([text, sub, V]) => {
      let el = document.getElementById("__lbl");
      if (!el) {
        el = document.createElement("div");
        el.id = "__lbl";
        el.style.cssText = `position:fixed;left:50%;bottom:${V ? 30 : 40}px;transform:translateX(-50%) translateY(14px);z-index:2147483647;pointer-events:none;
          background:rgba(59,36,24,.93);color:#FBF7F3;border-radius:999px;padding:${V ? "12px 24px" : "14px 30px"};text-align:center;white-space:nowrap;
          box-shadow:0 12px 32px rgba(59,36,24,.28);opacity:0;transition:opacity .5s ease,transform .5s ease;font-family:var(--font-sans),sans-serif`;
        document.body.appendChild(el);
      }
      const show = () => {
        el.innerHTML = text ? `<div style="font-size:${V ? 17 : 21}px;letter-spacing:.02em">${text}</div>${sub ? `<div style="font-size:${V ? 12 : 14}px;opacity:.75;margin-top:3px">${sub}</div>` : ""}` : "";
        el.style.opacity = text ? "1" : "0"; el.style.transform = `translateX(-50%) translateY(${text ? 0 : 14}px)`;
      };
      if (el.style.opacity === "1" && text) { el.style.opacity = "0"; setTimeout(show, 280); } else requestAnimationFrame(show);
    }, [text, sub, V]);

  const scrollTo = (to, ms) =>
    p.evaluate(([to, ms]) => new Promise((r) => {
      const max = document.documentElement.scrollHeight - innerHeight;
      const from = scrollY, d = Math.min(to === "end" ? max : to, max) - from, s = performance.now();
      const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
      const step = (n) => { const k = Math.min(1, (n - s) / ms); window.scrollTo(0, from + d * ease(k)); k < 1 ? requestAnimationFrame(step) : r(); };
      requestAnimationFrame(step);
    }), [to, ms]);
  const yOf = (sel, offset = V ? 70 : 90) => p.evaluate(([sel, offset]) => { const e = [...document.querySelectorAll(sel)].find((x) => x.offsetParent); return e ? e.getBoundingClientRect().top + scrollY - offset : null; }, [sel, offset]);
  const yOfText = (re, offset = V ? 70 : 90) => p.evaluate(([src, offset]) => {
    const r = new RegExp(src, "i"); const e = [...document.querySelectorAll("h1,h2,h3")].find((x) => x.offsetParent && r.test(x.textContent));
    return e ? e.getBoundingClientRect().top + scrollY - offset : null;
  }, [re, offset]);
  const scrollToText = async (re, ms) => { const y = await yOfText(re); if (y !== null) await scrollTo(y, ms); };
  const go = async (path) => { await p.goto(BASE + path, { waitUntil: "load", timeout: 60000 }); await p.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {}); await p.evaluate(() => document.fonts.ready); await wait(500); };
  const card = (html, bg, fg) => p.setContent(`<html><body style="margin:0;height:100vh;display:grid;place-items:center;background:${bg};color:${fg};font-family:Jost,sans-serif">
    <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;1,500&family=Jost:wght@300;400&display=swap" rel="stylesheet">
    <div style="text-align:center;padding:0 24px">${html}</div>
    <style>.a{animation:in 1.1s cubic-bezier(.2,.7,.2,1) both}.d1{animation-delay:.35s}.d2{animation-delay:.7s}.d3{animation-delay:1.05s}@keyframes in{from{opacity:0;transform:translateY(18px)}}
    .serif{font-family:'Cormorant Garamond',serif}.cap{letter-spacing:.32em;text-transform:uppercase;opacity:.7}</style></body></html>`, { waitUntil: "networkidle" });

  // Warm caches
  for (const path of ["/", "/shop", "/shop/serums", "/products/rare-glow-serum", "/bundles/the-glow-ritual", "/quiz", "/quiz/results?p=cloud-milk-cleanser,rare-glow-serum,sheer-glow-spf-50", "/journal"]) await go(path);

  // ── Intro
  await card(`<div class="cap a" style="font-size:${V ? 13 : 15}px">Kylva presents</div>
    <div class="serif a d1" style="font-size:${V ? 92 : 128}px;line-height:1;margin-top:16px">Melaré</div>
    <div class="serif a d2" style="font-size:${V ? 32 : 42}px;font-style:italic;color:#8A6623;margin-top:10px">Skin, but rarer.</div>
    <div class="a d3" style="font-size:${V ? 14 : 16}px;opacity:.7;margin-top:22px">A skincare store for melanin-rich skin</div>`, "#EBCFC8", "#3B2418");
  await p.evaluate(() => document.fonts.ready);
  await scene("intro", () => wait(3600));

  // ── Home
  await go("/");
  await scene("home", async () => {
    await wait(500);
    await label("Mobile-first & installable", "A PWA that feels like an app");
    await wait(2600);
    await label("Shop by skin concern");
    await scrollToText("Shop by concern", 2400); await wait(1200);
    await label("Bestsellers, new in & under ₦20k");
    await scrollToText("Loved right now", 2400); await wait(1300);
    await label("Curated bundles that save more");
    await scrollTo((await yOfText("ritual|bundle")) ?? (await p.evaluate(() => scrollY + innerHeight)), 2400); await wait(1300);
    await label("Real reviews & ingredient stories");
    await scrollTo(await p.evaluate(() => scrollY + innerHeight * 1.4), 2600); await wait(1100);
    await label("Skin quiz & skincare journal");
    await scrollTo(await p.evaluate(() => scrollY + innerHeight * 1.4), 2600); await wait(1100);
    await label("");
    await scrollTo(0, 2600); await wait(300);
  });

  // ── Mobile menu (vertical) / Shop
  if (V) {
    await go("/");
    await scene("menu", async () => {
      await wait(400);
      await label("Clean, simple navigation");
      await p.getByRole("button", { name: "Open menu" }).click();
      await wait(2600);
      await p.keyboard.press("Escape");
      await wait(700);
    });
  }
  await go("/shop");
  await scene("shop", async () => {
    await label("Browse the full range", "Filter by category & concern");
    await wait(2200);
    await scrollTo(V ? H * 1.3 : H * 0.7, 3000);
    await wait(1400);
    await label("");
    await wait(300);
  });

  // ── Product
  await go("/products/rare-glow-serum");
  await scene("product", async () => {
    await label("Beautiful product pages", "Benefits, ingredients, how to use");
    await wait(2400);
    await scrollTo(V ? H * 0.6 : H * 0.35, 2000); await wait(900);
    await label("Prices in ₦ or $ — your choice");
    await wait(900);
    await p.locator('button[aria-pressed="false"]:visible', { hasText: "USD" }).first().click(); await wait(2000);
    await p.locator('button[aria-pressed="false"]:visible', { hasText: "NGN" }).first().click(); await wait(1600);
    await label("Add to bag in one tap");
    await p.getByRole("button", { name: /^Add to bag ·/ }).first().click();
    await wait(2600);
    await label("Ingredients, how-to & reviews");
    await scrollTo(V ? H * 2.4 : H * 1.4, 3200); await wait(1500);
    await label("");
    await wait(300);
  });

  // ── Bundle
  await go("/bundles/the-glow-ritual");
  await scene("bundle", async () => {
    await label("Bundles with built-in savings");
    await wait(2400);
    await scrollTo(V ? H * 0.9 : H * 0.5, 2600); await wait(1500);
    await label(""); await wait(300);
  });

  // ── Quiz → results
  await go("/quiz");
  await scene("quiz", async () => {
    const tap = async (name) => { await p.locator("main button:visible", { hasText: name }).first().click({ timeout: 5000 }); if (!V) await p.evaluate(() => window.scrollTo(0, 0)); await wait(900); };
    await label("2-minute skin quiz");
    await wait(1400);
    await tap("Shiny all over");
    await tap("Dark spots"); await tap("Uneven tone");
    await p.locator("main button:visible", { hasText: /^Next$/ }).click({ timeout: 5000 }); if (!V) await p.evaluate(() => window.scrollTo(0, 0)); await wait(900);
    await tap("Rarely reacts");
    await tap("Keep it simple");
    await tap("Every day");
    await wait(1200);
  });
  await go("/quiz/results?p=cloud-milk-cleanser,rare-glow-serum,sheer-glow-spf-50");
  await scene("results", async () => {
    await label("A personal routine, step by step");
    await wait(2200);
    await scrollTo(V ? H * 0.55 : H * 0.25, 2800); await wait(1800);
    await label(""); await wait(300);
  });

  // ── Bag
  await go("/cart");
  await scene("bag", async () => {
    await label("A clear, honest bag", "Free Lagos delivery over ₦50k");
    await wait(2600);
    await scrollTo(V ? H * 0.3 : 0, 1600); await wait(1200);
    await label(""); await wait(300);
  });

  // ── Checkout
  await go("/checkout");
  await scene("checkout", async () => {
    await label("Fast checkout", "Guest or signed in");
    await wait(1600);
    const type = async (lbl, text) => { const el = p.getByLabel(lbl, { exact: true }).first(); await el.scrollIntoViewIfNeeded().catch(() => {}); await el.click(); await el.pressSequentially(text, { delay: 55 }); await wait(250); };
    await type("Email", "ada.obi@example.com");
    await type("Full name", "Ada Obi");
    await label("Smart Nigerian delivery", "Lagos 1–2 days · all 36 states");
    await scrollTo((await yOf("#address, [name=address], input[autocomplete='street-address']")) ?? H * 0.6, 1600);
    await type("Address", "12 Admiralty Way, Lekki Phase 1");
    await type("City / area", "Lekki");
    await p.locator("#state").selectOption({ label: "Lagos" }, { timeout: 4000 }).catch(() => {});
    await wait(800);
    await label("Pay in ₦ or $ with Flutterwave", "Card · Transfer · USSD");
    await scrollToText("Order summary", 2400); await wait(1400);
    await scrollTo((await yOf("button[type=submit]", V ? H * 0.55 : H * 0.6)) ?? 0, 1800); await wait(2000);
    await label(""); await wait(300);
  });

  // ── Journal
  await go("/journal");
  await scene("journal", async () => {
    await label("A journal that builds trust & SEO");
    await wait(2200);
    await scrollTo(V ? H * 1.2 : H * 0.6, 2800); await wait(1300);
    await label(""); await wait(300);
  });

  // ── Outro
  await card(`<div class="serif a" style="font-size:${V ? 72 : 100}px;line-height:1">Melaré</div>
    <div class="a d1" style="font-size:${V ? 15 : 18}px;opacity:.75;margin-top:18px;letter-spacing:.04em">Next.js · Tailwind · Flutterwave · PWA</div>
    <div class="cap a d2" style="margin-top:${V ? 48 : 44}px;font-size:${V ? 13 : 15}px;opacity:.6">Designed &amp; built by</div>
    <div class="serif a d2" style="font-size:${V ? 52 : 64}px;color:#D9B66A;margin-top:6px">Kylva</div>
    <div class="a d3" style="font-size:${V ? 14 : 16}px;opacity:.7;margin-top:18px">Need a store like this? Let’s talk.</div>`, "#3B2418", "#FBF7F3");
  await p.evaluate(() => document.fonts.ready);
  await scene("outro", () => wait(4200));
  await b.close();

  // ── Crossfade all scenes + music
  const durs = scenes.map((f) => parseFloat(sh(`ffprobe -v error -show_entries format=duration -of csv=p=0 ${f}`)));
  let filter = "", prev = "[0:v]", acc = durs[0];
  for (let i = 1; i < scenes.length; i++) {
    const off = (acc - FADE).toFixed(3);
    filter += `${prev}[${i}:v]xfade=transition=fade:duration=${FADE}:offset=${off}[v${i}];`;
    prev = `[v${i}]`;
    acc += durs[i] - FADE;
  }
  const total = acc;
  const m = scenes.length;
  filter += `${prev}format=yuv420p[v];[${m}:a]atrim=0:${total.toFixed(3)},afade=t=in:d=1.5,afade=t=out:st=${(total - 3).toFixed(3)}:d=3,volume=0.85[a]`;
  const out = `${OUT}/melare-${MODE}-long.mp4`;
  sh(`ffmpeg -y -loglevel error ${scenes.map((f) => `-i ${f}`).join(" ")} -i ${process.env.MUSIC || "music.mp3"} -filter_complex "${filter}" -map "[v]" -map "[a]" -c:v libx264 -preset slow -crf 18 -r 30 -c:a aac -b:a 192k -movflags +faststart ${out}`);
  console.log("→", out, total.toFixed(1) + "s");
})();
