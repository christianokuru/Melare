export const SITE = {
  name: "Melaré",
  tagline: "Skin, but rarer.",
  description:
    "Gentle, effective skincare made for melanin-rich skin. Brightening serums, barrier creams, cleansers and invisible SPF, delivered across Lagos, Nigeria and worldwide.",
  url: (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  instagram: process.env.NEXT_PUBLIC_INSTAGRAM_URL ?? "",
  city: "Lagos",
  country: "NG",
};

/** `number` comes from store settings (getSettings().whatsapp). Falls back to the contact page. */
export const whatsappLink = (number: string, text = "Hi Melaré, I have a question.") =>
  number ? `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(text)}` : "/contact";

export const CONCERNS = [
  { slug: "dark-spots", name: "Dark spots", letter: "D", blurb: "Fade post-acne marks and hyperpigmentation gently, without bleaching." },
  { slug: "breakouts", name: "Breakouts", letter: "B", blurb: "Calm active breakouts and keep pores clear without stripping." },
  { slug: "dullness", name: "Dull skin", letter: "G", blurb: "Bring back your natural glow with brightening, hydrating care." },
  { slug: "dryness", name: "Dryness", letter: "H", blurb: "Deep, lasting hydration that repairs and protects your barrier." },
  { slug: "uneven-tone", name: "Uneven tone", letter: "E", blurb: "Even out patches and texture for smooth, balanced skin." },
  { slug: "sensitivity", name: "Sensitivity", letter: "S", blurb: "Soothing, fragrance-conscious formulas for reactive skin." },
] as const;
export type ConcernSlug = (typeof CONCERNS)[number]["slug"];

export const SKIN_TYPES = ["Oily", "Dry", "Combination", "Normal", "Sensitive"] as const;

export const SORTS = { featured: "Featured", "price-asc": "Price: low to high", "price-desc": "Price: high to low", newest: "Newest" } as const;
export type Sort = keyof typeof SORTS;

export const COUNTRIES: Record<string, string> = {
  NG: "Nigeria", GH: "Ghana", KE: "Kenya", ZA: "South Africa", GB: "United Kingdom", IE: "Ireland",
  US: "United States", CA: "Canada", FR: "France", DE: "Germany", NL: "Netherlands", BE: "Belgium",
  IT: "Italy", ES: "Spain", AE: "United Arab Emirates", QA: "Qatar", SA: "Saudi Arabia", AU: "Australia",
};

export const NG_STATES = [
  "Abia", "Adamawa", "Akwa Ibom", "Anambra", "Bauchi", "Bayelsa", "Benue", "Borno", "Cross River", "Delta",
  "Ebonyi", "Edo", "Ekiti", "Enugu", "FCT", "Gombe", "Imo", "Jigawa", "Kaduna", "Kano", "Katsina", "Kebbi",
  "Kogi", "Kwara", "Lagos", "Nasarawa", "Niger", "Ogun", "Ondo", "Osun", "Oyo", "Plateau", "Rivers", "Sokoto",
  "Taraba", "Yobe", "Zamfara",
];

export const REFERRAL_REWARD = { NGN: 200000, USD: 300 } as const; // minor units
export const REFERRAL_MIN_SUBTOTAL = { NGN: 1000000, USD: 1500 } as const; // ₦10,000 / $15: no near-free referral orders
export const ORDER_PAYMENT_WINDOW_MIN = 30;
export const MAX_OPEN_ORDERS = 2; // unpaid orders one shopper may hold at once (stock hoarding)
export const MAX_ORDER_UNITS = 20;
export const MAX_LINE_QTY = 10;
