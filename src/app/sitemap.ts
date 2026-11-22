import type { MetadataRoute } from "next";
import { getBundles, getCategories, getProducts } from "@/lib/catalog";
import { CONCERNS, SITE } from "@/lib/constants";
import { ARTICLES } from "@/content/journal";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [products, categories, bundles] = await Promise.all([getProducts(), getCategories(), getBundles()]);
  const u = (path: string, priority: number, changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] = "weekly", lastModified?: Date | string) =>
    ({ url: `${SITE.url}${path}`, priority, changeFrequency, ...(lastModified ? { lastModified } : {}) });
  return [
    u("/", 1, "daily"), u("/shop", 0.9, "daily"), u("/bundles", 0.8), u("/quiz", 0.7, "monthly"), u("/journal", 0.6),
    ...products.map((p) => u(`/products/${p.slug}`, 0.9, "weekly", p.createdAt)),
    ...categories.map((c) => u(`/shop/${c.slug}`, 0.8, "weekly", c.updatedAt)),
    ...CONCERNS.map((c) => u(`/concerns/${c.slug}`, 0.8)),
    ...bundles.map((b) => u(`/bundles/${b.slug}`, 0.8, "weekly", b.updatedAt)),
    ...ARTICLES.map((a) => u(`/journal/${a.slug}`, 0.6, "monthly", a.published)),
    ...["/about", "/faq", "/shipping", "/returns", "/contact", "/track", "/privacy", "/terms"].map((p) => u(p, 0.3, "yearly")),
  ];
}
