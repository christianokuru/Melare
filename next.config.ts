import type { NextConfig } from "next";

const dev = process.env.NODE_ENV !== "production";
const https = (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://");

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""} https://www.googletagmanager.com https://connect.facebook.net`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://www.google-analytics.com https://www.facebook.com",
  "font-src 'self'",
  "connect-src 'self' https://*.google-analytics.com https://www.googletagmanager.com https://www.facebook.com",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  ...(https ? ["upgrade-insecure-requests"] : []),
].join("; ");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  experimental: { useOffline: true },
  poweredByHeader: false,
  images: { formats: ["image/avif", "image/webp"], minimumCacheTTL: 60 * 60 * 24 * 30 },
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
      { source: "/images/(.*)", headers: [{ key: "Cache-Control", value: "public, max-age=2592000, stale-while-revalidate=86400" }] },
    ];
  },
};

export default nextConfig;
