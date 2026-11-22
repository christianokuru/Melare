"use client";
import { useEffect } from "react";
import { ReactLenis } from "lenis/react";
import "lenis/dist/lenis.css";

/** Smooth scrolling (disabled for reduced-motion users) + service worker registration. */
export function ClientShell({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(() => {});
    }
  }, []);
  const reduced = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return (
    <ReactLenis root options={{ lerp: 0.1, smoothWheel: !reduced, syncTouch: false }}>
      {children}
    </ReactLenis>
  );
}
