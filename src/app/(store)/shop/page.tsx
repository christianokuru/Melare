import type { Metadata } from "next";
import { Listing } from "@/components/product/listing";

export const metadata: Metadata = {
  title: "Shop All Skincare for Melanin-Rich Skin",
  description: "Shop Melaré cleansers, dark spot serums, barrier creams and no-white-cast SPF made for Black and brown skin. Fast delivery in Lagos, across Nigeria and worldwide.",
  alternates: { canonical: "/shop" },
};

export default function ShopPage({ searchParams }: PageProps<"/shop">) {
  return <Listing title="Shop all" intro="Gentle, effective skincare for melanin-rich skin, from first cleanse to final SPF."
    crumbs={[{ name: "Home", href: "/" }, { name: "Shop" }]} base="/shop" fixed={{}} searchParams={searchParams} />;
}
