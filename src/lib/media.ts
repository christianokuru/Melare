/** Public base URL of the Neon Object Storage bucket (public_read). Safe on client and server. */
export const MEDIA_URL = (process.env.NEXT_PUBLIC_MEDIA_URL ?? "").replace(/\/$/, "");

export const MEDIA_FOLDERS = ["site", "products", "categories", "bundles"] as const;
export type MediaFolder = (typeof MEDIA_FOLDERS)[number];

/** URL for an object key, e.g. media("site/hero.webp"). */
export const media = (key: string) => `${MEDIA_URL}/${key}`;

/** True only for objects in our own bucket with a safe key (used to validate admin input). */
export const isMediaUrl = (url: string) =>
  !!MEDIA_URL && url.startsWith(`${MEDIA_URL}/`) &&
  /^(site|products|categories|bundles)\/[a-z0-9][a-z0-9-]{0,80}\.(webp|jpe?g|png|avif)$/.test(url.slice(MEDIA_URL.length + 1));
