export type Article = {
  slug: string; title: string; description: string; image: string; imageAlt: string; tag: string;
  published: string; readMinutes: number; products: string[];
  sections: { heading?: string; paragraphs: string[]; list?: string[] }[];
};

export const ARTICLES: Article[] = [
  {
    slug: "how-to-fade-dark-spots-on-melanin-rich-skin",
    title: "How to fade dark spots on melanin-rich skin (gently)",
    description: "A dermatologist-informed guide to fading hyperpigmentation and post-acne marks on Black and brown skin, without bleaching or irritation.",
    image: "/images/apply-cream.webp", imageAlt: "Woman with deep skin applying a cream to her cheek", tag: "Guide",
    published: "2026-10-02", readMinutes: 6, products: ["rare-glow-serum", "sheer-glow-spf-50", "midnight-renewal-cream"],
    sections: [
      { paragraphs: [
        "Dark spots are the most common skin concern we hear about in Lagos. Melanin-rich skin is beautifully resilient, but its pigment cells react quickly to inflammation. A pimple, a scratch or a harsh product can leave a mark that lingers for months. Doctors call this post-inflammatory hyperpigmentation (PIH).",
        "The good news: dark spots fade, and you don’t need bleaching creams or aggressive peels to get there. You need patience, consistency and a few proven ingredients.",
      ] },
      { heading: "1. Stop new spots before they start", paragraphs: [
        "Every new breakout or irritation can become a new mark, so calm skin is the foundation. Choose a gentle, non-stripping cleanser and avoid scrubs, lemon, toothpaste and other DIY “hacks” that inflame the skin and make pigmentation worse.",
      ] },
      { heading: "2. Wear sunscreen every single day", paragraphs: [
        "UV light keeps pigment cells switched on, which is why spots darken in the sun and refuse to fade. Daily SPF 50 is the single most effective step for fading marks on dark skin. Modern filters like those in Sheer Glow SPF 50 disappear without a white or grey cast.",
      ] },
      { heading: "3. Use ingredients that interrupt pigment", paragraphs: ["These ingredients are well studied and suitable for deep skin tones:"],
        list: [
          "Niacinamide (5–10%): slows pigment transfer and strengthens the barrier.",
          "Tranexamic acid: targets stubborn marks and melasma, gentle enough for daily use.",
          "Licorice root and azelaic acid: brighten and calm at the same time.",
          "Gentle exfoliants (lactic acid, bakuchiol): speed up cell turnover without the irritation of strong retinoids.",
        ] },
      { heading: "4. Be consistent for 8–12 weeks", paragraphs: [
        "Skin renews itself roughly every 4–6 weeks, and deeper marks take longer. Take a photo in the same light every two weeks so you can see progress that’s hard to notice day to day.",
        "If a spot is raised, changing, or doesn’t respond after three months, see a dermatologist to rule out other conditions.",
      ] },
    ],
  },
  {
    slug: "why-spf-matters-for-dark-skin",
    title: "Yes, dark skin needs sunscreen. Here’s why",
    description: "Melanin offers some natural protection, but not enough. Learn why daily SPF prevents dark spots, uneven tone and premature ageing on Black skin.",
    image: "/images/hero.webp", imageAlt: "Woman with glowing deep skin in warm sunlight", tag: "Sun care",
    published: "2026-09-14", readMinutes: 4, products: ["sheer-glow-spf-50", "rare-glow-serum"],
    sections: [
      { paragraphs: [
        "“Black don’t crack, so I don’t need sunscreen.” It’s one of the most persistent skincare myths. Melanin does give deeper skin a natural SPF of roughly 13, but that’s far below what dermatologists recommend, and it doesn’t protect against the visible light and UVA rays that drive hyperpigmentation.",
      ] },
      { heading: "Sun is the number-one cause of uneven tone", paragraphs: [
        "On melanin-rich skin, sun exposure rarely shows up as a burn. It shows up as dark spots that won’t fade, patches of uneven tone and melasma. If you’re treating marks with serums but skipping SPF, you’re undoing your own progress every day.",
      ] },
      { heading: "Finding a sunscreen that actually works on deep skin", paragraphs: ["Look for:"],
        list: ["SPF 50 with broad-spectrum (UVA + UVB) protection", "Zero white or grey cast", "A lightweight, non-greasy texture you’ll want to wear daily", "Niacinamide or antioxidants for extra brightening support"] },
      { heading: "How much to apply", paragraphs: [
        "Use two finger-lengths for your face and neck every morning, as the last step of your routine. Reapply every two hours when you’re outdoors, sweating or after swimming.",
      ] },
    ],
  },
  {
    slug: "simple-3-step-skincare-routine",
    title: "The simple 3-step routine for glowing skin",
    description: "You don’t need 10 steps. Build an effective morning and evening skincare routine for melanin-rich skin with just a cleanser, a treatment and protection.",
    image: "/images/routine-towel.webp", imageAlt: "Smiling woman in a bathrobe applying skincare", tag: "Routine",
    published: "2026-08-21", readMinutes: 5, products: ["cloud-milk-cleanser", "rare-glow-serum", "velvet-barrier-cream", "sheer-glow-spf-50"],
    sections: [
      { paragraphs: [
        "The best routine is the one you’ll actually do every day. For most people that means three steps in the morning and three at night. More products often means more irritation, and on melanin-rich skin irritation means dark marks.",
      ] },
      { heading: "Morning: cleanse, treat, protect", paragraphs: [], list: [
        "Cleanse with a gentle, non-stripping cleanser.",
        "Treat with a brightening serum like niacinamide to target dark spots and oil.",
        "Protect with SPF 50. If your skin is dry, add a light moisturiser before sunscreen.",
      ] },
      { heading: "Evening: cleanse, renew, nourish", paragraphs: [], list: [
        "Cleanse to remove sunscreen, sweat and pollution (massage for a full 60 seconds).",
        "Renew with your serum or a gentle resurfacing night cream 3–4 nights a week.",
        "Nourish with a barrier cream or a few drops of facial oil to seal in moisture.",
      ] },
      { heading: "Give it time", paragraphs: [
        "Introduce one new product at a time, every two weeks, so you know what’s working. Expect glow within days, and visible changes in tone within 8–12 weeks.",
        "Not sure where to start? Our two-minute skin quiz builds a routine around your skin type and concerns.",
      ] },
    ],
  },
];

export const getArticle = (slug: string) => ARTICLES.find((a) => a.slug === slug) ?? null;
