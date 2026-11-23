import type { Metadata } from "next";
import { InfoPage } from "@/components/site/info-page";
import { JsonLd } from "@/components/json-ld";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export const metadata: Metadata = { title: "FAQ", description: "Answers about Melaré products, delivery in Lagos and Nigeria, international shipping, payments and returns.", alternates: { canonical: "/faq" } };

const FAQ: [string, string][] = [
  ["Are Melaré products suitable for dark and Black skin?", "Yes. Every Melaré product is formulated and tested with melanin-rich skin in mind, with no bleaching agents and sunscreens that leave no white cast."],
  ["Do your products contain hydroquinone, mercury or steroids?", "Never. We use gentle, evidence-based brighteners like niacinamide, tranexamic acid and licorice root to fade dark spots safely."],
  ["How long until I see results on dark spots?", "Most people notice a glow within days and visible fading of marks in 8–12 weeks of consistent use with daily SPF."],
  ["How long does delivery take?", "Lagos: 1–2 business days. Other Nigerian states: 3–5 business days. International: 7–14 business days. You’ll see exact fees at checkout."],
  ["Do you ship outside Nigeria?", "Yes, we ship worldwide. Choose USD at the top of the page to shop in dollars."],
  ["How can I pay?", "We accept cards, bank transfer and USSD through Flutterwave for naira orders, and international cards for dollar orders. We never see or store your card details."],
  ["Can I return a product?", "Unopened products can be returned within 14 days of delivery. If a product causes a reaction, contact us and we’ll help."],
  ["How do I track my order?", "Use the tracking link in your confirmation email, visit Track order, or see all your orders in your account."],
  ["How does the referral programme work?", "Share your code from your account. Your friend signs in and gets ₦2,000 ($3) off their first order of ₦10,000 ($15) or more, and you get the same as a reward once they’ve paid."],
];

export default function FaqPage() {
  return (
    <InfoPage title="Frequently asked questions">
      <Accordion className="border-t">
        {FAQ.map(([q, a]) => (
          <AccordionItem key={q} value={q} className="border-b">
            <AccordionTrigger className="py-5 text-left text-[16px] hover:no-underline">{q}</AccordionTrigger>
            <AccordionContent className="pb-5 text-muted-foreground">{a}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
      <JsonLd data={{ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }} />
    </InfoPage>
  );
}
