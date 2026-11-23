import type { Metadata } from "next";
import { InfoPage } from "@/components/site/info-page";

export const metadata: Metadata = { title: "Terms of Service", description: "Terms that apply when you shop with Melaré.", alternates: { canonical: "/terms" } };

export default function TermsPage() {
  return (
    <InfoPage title="Terms of service">
      <p>By using this website and placing an order, you agree to these terms.</p>
      <h2>Orders & pricing</h2>
      <p>Prices are shown in Nigerian naira (₦) or US dollars ($) as selected. Orders delivered in Nigeria are charged in naira and orders delivered elsewhere in US dollars; the final amount is confirmed at checkout. Promo and referral codes need a signed-in account and can be used once per person. An order is accepted once payment is confirmed. Unpaid orders are released after 30 minutes. We may cancel and fully refund an order in case of pricing errors or stock unavailability.</p>
      <h2>Promotions</h2>
      <p>Promo and referral codes are limited to one per order, can’t be exchanged for cash, and may not be combined unless stated. Referral codes apply to a new customer’s first order of at least ₦10,000 ($15), can’t be used on your own orders, and each person (account, email or phone number) can benefit once. We may void codes or rewards obtained through abuse.</p>
      <h2>Product use</h2>
      <p>Patch test new products and follow the directions. Our content is for general information and isn’t medical advice.</p>
      <h2>Accounts</h2>
      <p>You’re responsible for keeping your password secure. We may suspend accounts involved in fraud or abuse.</p>
      <h2>Governing law</h2>
      <p>These terms are governed by the laws of the Federal Republic of Nigeria.</p>
    </InfoPage>
  );
}
