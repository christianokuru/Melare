import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "@/components/site/info-page";
import { whatsappLink } from "@/lib/constants";
import { getSettings } from "@/lib/settings";
import { buttonOutline, buttonPrimary } from "@/components/site/section";

export const metadata: Metadata = { title: "Contact Us", description: "Questions about your skin, an order or delivery? Chat with Melaré on WhatsApp.", alternates: { canonical: "/contact" } };

export default async function ContactPage() {
  const { whatsapp } = await getSettings();
  return (
    <InfoPage title="Contact us" intro="Questions about your skin, an order or delivery? We’re happy to help.">
      <p>The fastest way to reach us is WhatsApp. We reply Monday to Saturday, 9am–6pm (WAT). Please include your order number if your question is about an order.</p>
      <div className="flex flex-wrap gap-3">
        <a href={whatsappLink(whatsapp)} target="_blank" rel="noopener noreferrer" className={buttonPrimary}>Chat on WhatsApp</a>
        <Link href="/track" className={buttonOutline}>Track an order</Link>
      </div>
      <p>Looking for quick answers? See our <Link href="/faq">FAQ</Link>, <Link href="/shipping">shipping</Link> and <Link href="/returns">returns</Link> pages.</p>
    </InfoPage>
  );
}
