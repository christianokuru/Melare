import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Melaré — Skin, but rarer.",
    short_name: "Melaré",
    description: "Skincare for rich, glowing skin.",
    start_url: "/",
    display: "standalone",
    background_color: "#F6EFE6",
    theme_color: "#3B2418",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
