// Seeds the catalogue. Idempotent: skips if products already exist.  npx tsx scripts/seed.ts
import { config } from "dotenv";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as s from "../src/db/schema";

config({ path: ".env.local" });
const db = drizzle(new Pool({ connectionString: process.env.DATABASE_URL }), { schema: s });
const N = (naira: number) => naira * 100;
const D = (usd: number) => usd * 100;

async function main() {
  const existing = await db.select({ id: s.products.id }).from(s.products).limit(1);
  if (existing.length) return console.log("Catalogue already seeded");

  const cats = await db.insert(s.categories).values([
    { slug: "cleansers", name: "Cleansers", position: 1, image: "/images/pump-bottle.webp", description: "Gentle cleansers that melt away sunscreen, makeup and the day without stripping melanin-rich skin." },
    { slug: "serums", name: "Serums & Oils", position: 2, image: "/images/serum-amber.webp", description: "Concentrated treatments that fade dark spots, even tone and restore your natural glow." },
    { slug: "moisturisers", name: "Moisturisers", position: 3, image: "/images/cream-jar.webp", description: "Barrier-loving creams for lasting hydration, day and night, in Lagos humidity or harmattan." },
    { slug: "sun-care", name: "Sun Care", position: 4, image: "/images/fluid-white.webp", description: "Invisible, no-white-cast SPF made for deep skin tones. The most important step for preventing dark spots." },
  ]).returning();
  const cat = (slug: string) => cats.find((c) => c.slug === slug)!.id;

  const products = [
    {
      slug: "cloud-milk-cleanser", name: "Cloud Milk Cleanser", category: "cleansers", daysSupply: 60, featured: false,
      tagline: "A soft, milky cleanser that never leaves skin tight",
      description: "A gentle, pH-balanced milk cleanser that lifts sunscreen, sweat and makeup while keeping your moisture barrier intact. Oat extract and glycerin calm and hydrate, so skin feels soft and comfortable, never squeaky or ashy.",
      benefits: ["Removes SPF and makeup without stripping", "Calms redness and irritation", "Leaves skin soft, never ashy", "Fragrance-free, suitable for sensitive skin"],
      ingredients: "Aqua, Glycerin, Avena Sativa (Oat) Kernel Extract, Coco-Glucoside, Squalane, Panthenol, Allantoin, Cetearyl Alcohol, Sodium PCA, Citric Acid, Phenoxyethanol, Ethylhexylglycerin.",
      howToUse: "Morning and night, massage one pump onto damp skin for 60 seconds. Rinse with lukewarm water and pat dry.",
      skinTypes: ["Oily", "Dry", "Combination", "Normal", "Sensitive"], concerns: ["sensitivity", "dryness", "breakouts"],
      images: [["/images/pump-bottle.webp", "Cloud Milk Cleanser pump bottle on soft fabric"], ["/images/lotion-pink.webp", "Milky cleanser texture flowing over a hand"]],
      variants: [{ sku: "MLR-CMC-150", label: "150ml", priceNgn: N(16000), priceUsd: D(18), stock: 40 }, { sku: "MLR-CMC-300", label: "300ml", priceNgn: N(27000), priceUsd: D(30), stock: 25 }],
    },
    {
      slug: "rare-glow-serum", name: "Rare Glow Serum", category: "serums", daysSupply: 45, featured: true,
      tagline: "Brightening serum that fades dark spots and evens tone",
      description: "Our signature serum pairs 10% niacinamide with tranexamic acid and licorice root to visibly fade post-acne marks and hyperpigmentation on melanin-rich skin, without bleaching agents. Lightweight, fast-absorbing and made to be worn under SPF every morning.",
      benefits: ["Visibly fades dark spots and acne marks", "Evens tone without bleaching", "Refines the look of pores", "Lightweight, layers under SPF"],
      ingredients: "Aqua, Niacinamide (10%), Tranexamic Acid (3%), Glycyrrhiza Glabra (Licorice) Root Extract, Sodium Hyaluronate, Panthenol, Zinc PCA, Pentylene Glycol, Xanthan Gum, Phenoxyethanol.",
      howToUse: "Apply 3–4 drops to clean skin morning and night, before moisturiser. Always follow with SPF in the morning.",
      skinTypes: ["Oily", "Combination", "Normal", "Dry"], concerns: ["dark-spots", "uneven-tone", "dullness"],
      images: [["/images/serum-amber.webp", "Rare Glow Serum amber dropper bottle on a stone plinth"], ["/images/drops-peach.webp", "Golden serum drops on a soft peach background"]],
      variants: [{ sku: "MLR-RGS-30", label: "30ml", priceNgn: N(28500), priceUsd: D(32), stock: 40 }],
    },
    {
      slug: "gold-drop-facial-oil", name: "Gold Drop Facial Oil", category: "serums", daysSupply: 60, featured: false,
      tagline: "A silky glow oil for deep, lasting nourishment",
      description: "A featherlight blend of marula, baobab and rosehip oils that melts into skin to restore suppleness and a lit-from-within glow. Rich in omegas and antioxidants, it seals in hydration through harmattan and air-conditioning alike.",
      benefits: ["Instant, natural-looking glow", "Seals in moisture for 24 hours", "Softens dry, flaky patches", "Non-greasy finish"],
      ingredients: "Sclerocarya Birrea (Marula) Seed Oil, Adansonia Digitata (Baobab) Seed Oil, Rosa Canina (Rosehip) Fruit Oil, Squalane, Tocopherol, Bisabolol.",
      howToUse: "Warm 2–3 drops between your palms and press onto skin as the last step of your evening routine, or mix with moisturiser.",
      skinTypes: ["Dry", "Normal", "Combination"], concerns: ["dryness", "dullness"],
      images: [["/images/serum-gold.webp", "Gold Drop Facial Oil glass dropper bottle with gold cap"], ["/images/oil-hands.webp", "Facial oil being applied from a glass dropper"]],
      variants: [{ sku: "MLR-GDO-30", label: "30ml", priceNgn: N(26000), priceUsd: D(29), stock: 3 }],
    },
    {
      slug: "velvet-barrier-cream", name: "Velvet Barrier Cream", category: "moisturisers", daysSupply: 45, featured: true,
      tagline: "Rich, cushiony moisture that repairs your skin barrier",
      description: "A velvety cream with ceramides, shea butter and colloidal oat that repairs a stressed barrier and locks in moisture for 48 hours. Comforting for dry and sensitive skin, yet it absorbs without a greasy film.",
      benefits: ["48-hour hydration", "Repairs and strengthens the skin barrier", "Soothes sensitivity and tightness", "Absorbs quickly, no greasy film"],
      ingredients: "Aqua, Butyrospermum Parkii (Shea) Butter, Glycerin, Ceramide NP, Ceramide AP, Ceramide EOP, Cholesterol, Colloidal Oatmeal, Squalane, Niacinamide, Cetearyl Alcohol, Phenoxyethanol.",
      howToUse: "Smooth a pea-sized amount over face and neck morning and night after serum.",
      skinTypes: ["Dry", "Normal", "Sensitive", "Combination"], concerns: ["dryness", "sensitivity"],
      images: [["/images/cream-jar.webp", "Velvet Barrier Cream jar floating above a stone"], ["/images/cream-swatch.webp", "Rich cream texture swatch"]],
      variants: [{ sku: "MLR-VBC-50", label: "50ml", priceNgn: N(24000), priceUsd: D(27), stock: 40 }],
    },
    {
      slug: "midnight-renewal-cream", name: "Midnight Renewal Cream", category: "moisturisers", daysSupply: 60, featured: false,
      tagline: "Overnight renewal for smoother, more even skin",
      description: "A night cream with encapsulated bakuchiol and lactic acid that gently resurfaces while you sleep, refining texture and fading uneven patches. Peptides and squalane cushion the skin so you wake up smooth, never irritated.",
      benefits: ["Smooths texture overnight", "Gently fades uneven patches", "Retinol-alternative, gentle on deep skin", "Wake up to soft, plump skin"],
      ingredients: "Aqua, Squalane, Glycerin, Lactic Acid (5%), Bakuchiol (1%), Palmitoyl Tripeptide-1, Palmitoyl Tetrapeptide-7, Sodium Hyaluronate, Cetearyl Olivate, Sorbitan Olivate, Phenoxyethanol.",
      howToUse: "Apply a thin layer at night after serum, 3–4 nights a week to start. Use SPF daily.",
      skinTypes: ["Normal", "Combination", "Oily", "Dry"], concerns: ["uneven-tone", "dark-spots", "breakouts"],
      images: [["/images/cream-jar-dark.webp", "Midnight Renewal Cream open jar on dark stone"], ["/images/apply-cream.webp", "Woman applying night cream to her cheek"]],
      variants: [{ sku: "MLR-MRC-50", label: "50ml", priceNgn: N(30000), priceUsd: D(34), compareAtNgn: N(34000), compareAtUsd: D(38), stock: 30 }],
    },
    {
      slug: "sheer-glow-spf-50", name: "Sheer Glow SPF 50", category: "sun-care", daysSupply: 40, featured: true,
      tagline: "Invisible sunscreen with zero white cast on deep skin",
      description: "A weightless, broad-spectrum SPF 50 fluid that disappears on every shade of brown, with no white or grey cast. Daily sun protection is the single most effective way to prevent dark spots, and this one feels like nothing.",
      benefits: ["Broad-spectrum SPF 50 / PA++++", "Zero white cast on deep skin", "Dewy, non-greasy finish", "Prevents new dark spots"],
      ingredients: "Aqua, Homosalate, Ethylhexyl Salicylate, Bis-Ethylhexyloxyphenol Methoxyphenyl Triazine, Diethylamino Hydroxybenzoyl Hexyl Benzoate, Niacinamide, Glycerin, Tocopherol, Phenoxyethanol.",
      howToUse: "Apply two finger-lengths as the last step of your morning routine. Reapply every 2 hours in direct sun.",
      skinTypes: ["Oily", "Dry", "Combination", "Normal", "Sensitive"], concerns: ["dark-spots", "uneven-tone"],
      images: [["/images/fluid-white.webp", "Sheer Glow SPF 50 white dropper bottle on marble"], ["/images/portrait-afro.webp", "Woman with glowing deep skin"]],
      variants: [{ sku: "MLR-SPF-50", label: "50ml", priceNgn: N(19500), priceUsd: D(22), stock: 40 }],
    },
  ];

  const variantBySku: Record<string, string> = {};
  for (const { images, variants, category, ...p } of products) {
    const [row] = await db.insert(s.products).values({ ...p, categoryId: cat(category), status: "active" }).returning();
    await db.insert(s.productImages).values(images.map(([src, alt], position) => ({ productId: row.id, src, alt, position })));
    const vs = await db.insert(s.productVariants).values(variants.map((v, position) => ({ ...v, productId: row.id, position }))).returning();
    for (const v of vs) variantBySku[v.sku] = v.id;
  }

  const [glow, night] = await db.insert(s.bundles).values([
    { slug: "the-glow-ritual", name: "The Glow Ritual", discountPercent: 15, image: "/images/flatlay-pink.webp",
      tagline: "Cleanse, brighten, protect: your complete morning routine",
      description: "Everything you need for brighter, more even skin every morning: Cloud Milk Cleanser, Rare Glow Serum and Sheer Glow SPF 50. Together they fade dark spots and stop new ones from forming, for less than buying separately." },
    { slug: "the-night-ritual", name: "The Night Ritual", discountPercent: 12, image: "/images/flatlay-marble.webp",
      tagline: "Restore and renew while you sleep",
      description: "Cloud Milk Cleanser, Gold Drop Facial Oil and Midnight Renewal Cream: an evening routine that smooths texture, deeply nourishes and wakes you up glowing." },
  ]).returning();
  await db.insert(s.bundleItems).values([
    { bundleId: glow.id, variantId: variantBySku["MLR-CMC-150"] }, { bundleId: glow.id, variantId: variantBySku["MLR-RGS-30"] }, { bundleId: glow.id, variantId: variantBySku["MLR-SPF-50"] },
    { bundleId: night.id, variantId: variantBySku["MLR-CMC-150"] }, { bundleId: night.id, variantId: variantBySku["MLR-GDO-30"] }, { bundleId: night.id, variantId: variantBySku["MLR-MRC-50"] },
  ]);

  await db.insert(s.shippingZones).values([
    { name: "Lagos", country: "NG", state: "Lagos", feeNgn: N(3000), feeUsd: D(4), freeOverNgn: N(50000), freeOverUsd: D(60), eta: "1–2 business days", position: 1 },
    { name: "Nigeria", country: "NG", feeNgn: N(5500), feeUsd: D(7), freeOverNgn: N(80000), freeOverUsd: D(100), eta: "3–5 business days", position: 2 },
    { name: "International", country: "*", feeNgn: N(45000), feeUsd: D(35), freeOverNgn: N(250000), freeOverUsd: D(200), eta: "7–14 business days", position: 3 },
  ]);
  await db.insert(s.coupons).values({ code: "WELCOME10", percentOff: 10, ownerName: "Newsletter welcome" });
  console.log("Seeded", products.length, "products");
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
