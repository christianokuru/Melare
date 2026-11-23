import Image from "next/image";
import Link from "next/link";
import { CONCERNS, SITE, whatsappLink } from "@/lib/constants";
import { getSettings } from "@/lib/settings";
import { NewsletterForm } from "./newsletter-form";
import { CookieSettingsLink } from "@/components/cookie-banner";
import { ChatIcon, GlobeIcon, ShieldIcon, TruckIcon } from "./icons";
import { providerNames } from "@/lib/gateways";

const COLUMNS = [
  { title: "Shop", links: [["All products", "/shop"], ["Cleansers", "/shop/cleansers"], ["Serums & oils", "/shop/serums"], ["Moisturisers", "/shop/moisturisers"], ["Sun care", "/shop/sun-care"], ["Bundles", "/bundles"]] },
  { title: "Concerns", links: [...CONCERNS.slice(0, 5).map((c) => [c.name, `/concerns/${c.slug}`]), ["Skin quiz", "/quiz"]] },
  { title: "Help", links: [["Track your order", "/track"], ["Shipping", "/shipping"], ["Returns", "/returns"], ["FAQ", "/faq"], ["Contact", "/contact"]] },
  { title: "Melaré", links: [["Our story", "/about"], ["Journal", "/journal"], ["My account", "/account"], ["Privacy", "/privacy"], ["Terms", "/terms"]] },
];

export async function Footer() {
  const { whatsapp } = await getSettings();
  const services = [
    { icon: TruckIcon, title: "Fast delivery", text: "Lagos in 1–2 days" },
    { icon: GlobeIcon, title: "Ships worldwide", text: "7–14 business days" },
    { icon: ShieldIcon, title: "Secure payment", text: "Card, transfer or USSD" },
    { icon: ChatIcon, title: "Need help?", text: "Chat with us on WhatsApp", href: whatsappLink(whatsapp) },
  ];
  return (
    <footer className="mt-24">
      <ul className="grid grid-cols-2 border-y lg:grid-cols-4">
        {services.map(({ icon: Icon, title, text, href }, i) => (
          <li key={title} className={`flex flex-col items-center gap-1 px-3 py-6 text-center ${i % 2 === 0 ? "border-r" : ""} ${i < 2 ? "border-b lg:border-b-0" : ""} lg:border-r lg:last:border-r-0`}>
            <Icon className="mb-1" />
            <span className="eyebrow">{title}</span>
            {href ? <a href={href} target="_blank" rel="noopener noreferrer" className="text-[13px] text-muted-foreground underline-offset-4 hover:underline">{text}</a> : <span className="text-[13px] text-muted-foreground">{text}</span>}
          </li>
        ))}
      </ul>
      <section className="px-6 py-16 text-center" aria-labelledby="nl-title">
        <h2 id="nl-title" className="font-heading text-3xl lg:text-4xl">Join the Melaré circle</h2>
        <p className="mt-2 mb-6 text-sm text-muted-foreground">10% off your first order, early access to launches and members-only offers.</p>
        <div className="flex justify-center"><NewsletterForm /></div>
      </section>
      <div className="bg-blush px-5 pt-14 pb-28 lg:px-10 lg:pb-10">
        <div className="mx-auto grid max-w-[1440px] grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="col-span-2 lg:col-span-1">
            <Image src="/logo.svg" alt="Melaré" width={120} height={52} className="h-10 w-auto" />
            <p className="mt-4 max-w-xs text-sm text-muted-foreground">Skincare for rich, glowing skin. Made with care in {SITE.city}, shipped worldwide.</p>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <p className="eyebrow mb-3 text-muted-foreground">{col.title}</p>
              <ul>{col.links.map(([label, href]) => <li key={href}><Link href={href} className="block py-1.5 text-sm hover:underline underline-offset-4">{label}</Link></li>)}</ul>
            </nav>
          ))}
        </div>
        <div className="mx-auto mt-12 flex max-w-[1440px] flex-wrap justify-between gap-3 border-t border-foreground/15 pt-5 text-xs text-muted-foreground">
          <span>© Melaré. All rights reserved.</span>
          <span className="flex flex-wrap gap-x-4 gap-y-1">
            <span>Payments secured by {providerNames()}</span>
            <CookieSettingsLink className="underline-offset-4 hover:underline" />
          </span>
          <span className="w-full text-center lg:w-auto">Made with love by <a href="https://kylva.com" target="_blank" rel="noopener" className="text-foreground underline underline-offset-4">Kylva</a></span>
        </div>
      </div>
    </footer>
  );
}
