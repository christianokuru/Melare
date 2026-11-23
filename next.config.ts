import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";
const https = (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://");
const media = process.env.NEXT_PUBLIC_MEDIA_URL ? new URL(process.env.NEXT_PUBLIC_MEDIA_URL) : null; // Neon Object Storage bucket

// 'unsafe-inline' is required: Next.js streams page data in inline <script> tags, and nonces would force fully
// dynamic rendering (incompatible with static shells / Partial Prerendering). Mitigations: SRI integrity hashes on every
// JS chunk (below), a short script-src allowlist, no object/base/frame embedding, React escaping, no innerHTML sinks.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com https://connect.facebook.net https://www.clarity.ms https://*.clarity.ms`,
  "style-src 'self' 'unsafe-inline'",
  `img-src 'self' data: blob:${media ? ` ${media.origin}` : ""} https://*.google-analytics.com https://*.googletagmanager.com https://www.facebook.com https://*.clarity.ms https://c.bing.com`,
  "font-src 'self'",
  "connect-src 'self' https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://www.facebook.com https://*.clarity.ms https://c.bing.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(https ? ["upgrade-insecure-requests"] : []),
].join("; ");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: { useOffline: true, sri: { algorithm: "sha256" } }, // JS chunks carry integrity hashes; server actions keep the default 1 MB body limit (uploads use /admin/upload)
  poweredByHeader: false,
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 60 * 60 * 24 * 30,
    remotePatterns: media ? [{ protocol: "https", hostname: media.hostname, pathname: `${media.pathname}/**` }] : [],
  },
  turbopack: {
    rules: { "*.css": { loaders: ["@tailwindcss/turbopack"], as: "*.css" } },
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
          ...(https ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }] : []),
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
        ],
      },
    ];
  },
};

export default nextConfig;
