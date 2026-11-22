import type { Metadata } from "next";
import { InfoPage } from "@/components/site/info-page";

export const metadata: Metadata = { title: "Privacy Policy", description: "How Melaré collects, uses and protects your personal data.", alternates: { canonical: "/privacy" } };

export default function PrivacyPage() {
  return (
    <InfoPage title="Privacy policy" intro="We respect your privacy and only collect what we need to serve you.">
      <h2>What we collect</h2>
      <ul>
        <li>Account details: name, email, phone and saved addresses.</li>
        <li>Order details: items, delivery address and payment status. Card details are handled entirely by Flutterwave and never reach our servers.</li>
        <li>Technical data: essential cookies for your bag, sign-in and currency preference. With your consent only, analytics cookies from Google Analytics (pages visited, device, approximate location, traffic source), Microsoft Clarity (anonymised session replays and heatmaps; form inputs are masked) and Meta Pixel (ad measurement). You can change your choice any time via “Cookie settings” in the footer.</li>
      </ul>
      <h2>How we use it</h2>
      <ul>
        <li>To process and deliver your orders and send order updates.</li>
        <li>To provide your account, favourites and referral rewards.</li>
        <li>To send marketing emails only if you subscribe. You can unsubscribe at any time.</li>
        <li>To protect our store against fraud and abuse.</li>
      </ul>
      <h2>Sharing</h2>
      <p>We share data only with providers that help us operate: payment processing (Flutterwave), delivery partners, email delivery, hosting and, if you consent, analytics (Google, Microsoft, Meta). We never sell your data.</p>
      <h2>Your rights</h2>
      <p>Under the Nigeria Data Protection Act and similar laws, you can request access to, correction of, or deletion of your personal data. Contact us to make a request.</p>
    </InfoPage>
  );
}
