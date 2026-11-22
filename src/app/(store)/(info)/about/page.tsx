import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { InfoPage } from "@/components/site/info-page";
import { media } from "@/lib/media";

export const metadata: Metadata = { title: "Our Story", description: "Melaré makes gentle, effective skincare for melanin-rich skin, from Lagos to the world.", alternates: { canonical: "/about" } };

export default function AboutPage() {
  return (
    <InfoPage title="Our story" intro="Skincare made for melanin-rich skin, from Lagos to the world.">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-sand"><Image src={media("site/smile-mask.webp")} alt="Smiling woman applying a cream mask" fill sizes="672px" className="object-cover" /></div>
      <p>For too long, skincare for deep skin tones meant harsh “toning” creams, white-cast sunscreens and products formulated for someone else. Melaré was created to change that.</p>
      <p>We believe melanin-rich skin deserves formulas that respect it: effective actives at gentle, considered strengths, no bleaching agents, and textures that disappear on every shade of brown. Every product is designed to answer the concerns we hear most: dark spots, uneven tone, breakouts and dryness.</p>
      <h2>What we stand for</h2>
      <ul>
        <li>Proven ingredients like niacinamide, tranexamic acid and ceramides, never mercury, hydroquinone or steroids.</li>
        <li>Sunscreen with zero white cast, because daily SPF is the foundation of even skin.</li>
        <li>Simple routines that work, not ten-step regimes.</li>
        <li>Honest education, so you can make the best choices for your skin.</li>
      </ul>
      <p>Not sure where to start? <Link href="/quiz">Take our two-minute skin quiz</Link>.</p>
    </InfoPage>
  );
}
