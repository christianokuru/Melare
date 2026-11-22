import type { Metadata } from "next";
import Link from "next/link";
import { InfoPage } from "@/components/site/info-page";

export const metadata: Metadata = { title: "Returns & Refunds", description: "Melaré’s 14-day returns policy for unopened products, and what to do if a product doesn’t suit your skin.", alternates: { canonical: "/returns" } };

export default function ReturnsPage() {
  return (
    <InfoPage title="Returns & refunds">
      <p>We want you to love your Melaré products. If something isn’t right, we’re here to help.</p>
      <h2>Unopened products</h2>
      <p>You can return unopened, unused products in their original packaging within 14 days of delivery. Once we receive and inspect the return, we’ll refund the product price to your original payment method within 5–10 business days.</p>
      <h2>If a product doesn’t suit your skin</h2>
      <p>Stop using it and <Link href="/contact">contact us</Link> within 30 days of delivery with your order number. We’ll review it and suggest an alternative or a refund.</p>
      <h2>Damaged or incorrect items</h2>
      <p>If your order arrives damaged or incorrect, contact us within 48 hours with a photo and we’ll replace it at no cost.</p>
      <h2>How to start a return</h2>
      <p>Email or WhatsApp us with your order number and the item(s) you’d like to return. For hygiene reasons, opened products can’t be resold and are only refunded in the cases above.</p>
    </InfoPage>
  );
}
