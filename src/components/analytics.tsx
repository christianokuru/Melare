"use client";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useConsent } from "@/lib/consent";

// Pages that carry tokens (reset link, payment reference) or personal data. Analytics never START on them,
// page views drop query strings, and these pages' content is masked in Clarity (data-clarity-mask on their layouts).
const PRIVATE = /^\/(admin|account|checkout\/complete|reset-password|forgot-password|sign-in|sign-up|track)(\/|$)/;
declare global { interface Window { gtag?: (...args: unknown[]) => void } }

// IDs are validated before being placed in inline scripts.
const GA = /^G-[A-Z0-9]{4,20}$/.test(process.env.NEXT_PUBLIC_GA_ID ?? "") ? process.env.NEXT_PUBLIC_GA_ID : null;
const CLARITY = /^[a-z0-9]{6,20}$/i.test(process.env.NEXT_PUBLIC_CLARITY_ID ?? "") ? process.env.NEXT_PUBLIC_CLARITY_ID : null;
const PIXEL = /^\d{6,20}$/.test(process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "") ? process.env.NEXT_PUBLIC_META_PIXEL_ID : null;
export const analyticsEnabled = !!(GA || CLARITY || PIXEL);

/** GA4, Microsoft Clarity and Meta Pixel. Nothing loads until the visitor accepts cookies. */
export function Analytics() {
  const consent = useConsent();
  const path = usePathname();
  const [started, setStarted] = useState(false);
  if (!started && consent === "granted" && !PRIVATE.test(path)) setStarted(true); // first public page starts analytics

  // Client navigations: page views without the query string (the first one is sent by the config below, also without it).
  const first = useRef<string | null>(null);
  useEffect(() => {
    if (!started || !GA) return;
    if (first.current === null) { first.current = path; return; }
    if (!PRIVATE.test(path)) window.gtag?.("event", "page_view", { page_location: location.origin + path, page_path: path, page_title: document.title });
  }, [started, path]);

  if (consent !== "granted" || !started) return null;
  return (
    <>
      {GA && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${GA}`} strategy="afterInteractive" />
          <Script id="ga" strategy="afterInteractive">{`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${GA}',{page_location:location.origin+location.pathname});`}</Script>
        </>
      )}
      {CLARITY && (
        <Script id="clarity" strategy="afterInteractive">{`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${CLARITY}");`}</Script>
      )}
      {PIXEL && (
        <Script id="pixel" strategy="afterInteractive">{`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${PIXEL}');fbq('track','PageView');`}</Script>
      )}
    </>
  );
}
