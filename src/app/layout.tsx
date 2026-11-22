import type { Metadata, Viewport } from "next";
import { Jost, Cormorant_Garamond } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ClientShell } from "@/components/providers/client-shell";
import { Analytics } from "@/components/analytics";
import { JsonLd } from "@/components/json-ld";
import { SITE } from "@/lib/constants";
import "./globals.css";

const sans = Jost({ variable: "--font-sans", subsets: ["latin"], weight: ["300", "400", "500"], display: "swap" });
const serif = Cormorant_Garamond({ variable: "--font-serif", subsets: ["latin"], weight: ["400", "500"], style: ["normal", "italic"], display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: { default: "Melaré · Skincare for Melanin-Rich Skin | Lagos, Nigeria", template: "%s | Melaré" },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: ["skincare for black skin", "skincare Nigeria", "skincare Lagos", "melanin skincare", "dark spot serum", "sunscreen for dark skin", "hyperpigmentation treatment", "niacinamide serum Nigeria"],
  alternates: { canonical: "/" },
  openGraph: { type: "website", siteName: SITE.name, locale: "en_NG", url: "/", title: "Melaré · Skin, but rarer.", description: SITE.description },
  twitter: { card: "summary_large_image", title: "Melaré · Skin, but rarer.", description: SITE.description },
  appleWebApp: { capable: true, title: SITE.name, statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/apple-icon.png" },
  formatDetection: { telephone: false },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
};

export const viewport: Viewport = { themeColor: "#FBF7F3", width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-NG" className={`${sans.variable} ${serif.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-[15px] leading-relaxed text-foreground">
        <ClientShell>{children}</ClientShell>
        <Toaster position="top-center" />
        <Analytics />
        <JsonLd data={{
          "@context": "https://schema.org",
          "@graph": [
            { "@type": "Organization", "@id": `${SITE.url}/#org`, name: SITE.name, url: SITE.url, logo: `${SITE.url}/icon-512.png`, slogan: SITE.tagline,
              address: { "@type": "PostalAddress", addressLocality: SITE.city, addressCountry: SITE.country },
              ...(SITE.instagram ? { sameAs: [SITE.instagram] } : {}) },
            { "@type": "WebSite", "@id": `${SITE.url}/#site`, url: SITE.url, name: SITE.name, publisher: { "@id": `${SITE.url}/#org` },
              potentialAction: { "@type": "SearchAction", target: `${SITE.url}/shop?q={search_term_string}`, "query-input": "required name=search_term_string" } },
          ],
        }} />
      </body>
    </html>
  );
}
