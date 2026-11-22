import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Melaré · Skin, but rarer.",
    short_name: "Melaré",
    description: "Skincare for melanin-rich skin.",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    background_color: "#FBF7F3",
    theme_color: "#FBF7F3",
    categories: ["shopping", "beauty", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Shop", url: "/shop" },
      { name: "My orders", url: "/account/orders" },
      { name: "Skin quiz", url: "/quiz" },
    ],
  };
}
