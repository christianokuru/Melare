import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { getCategories } from "@/lib/catalog";
import { whatsappLink } from "@/lib/constants";
import { MobileMenu } from "./mobile-menu";
import { SearchSheet } from "./search-sheet";
import { AccountLink, BagLink, HeaderCurrency } from "./header-dynamic";
import { BagIcon, UserIcon } from "./icons";

export async function Header() {
  const categories = (await getCategories()).map(({ slug, name }) => ({ slug, name }));
  const nav = "eyebrow py-2 hover:underline underline-offset-4";
  return (
    <>
      <div className="bg-blush">
        <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-1.5 text-[11px] tracking-[0.08em] uppercase lg:px-10">
          <p className="truncate"><span className="sm:hidden">Free Lagos delivery over ₦50k</span><span className="max-sm:hidden">Free Lagos delivery over ₦50,000 · Ships worldwide</span></p>
          <Suspense fallback={<div className="h-8 w-[118px]" />}><HeaderCurrency className="shrink-0" /></Suspense>
        </div>
      </div>
      <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto grid max-w-[1440px] grid-cols-[1fr_auto_1fr] items-center px-2 py-1 lg:px-8 lg:py-2">
          <div className="flex items-center">
            <MobileMenu categories={categories} whatsapp={whatsappLink()} />
            <nav aria-label="Main" className="hidden items-center gap-7 lg:flex">
              <Link href="/shop" className={nav}>Shop</Link>
              <Link href="/concerns/dark-spots" className={nav}>Concerns</Link>
              <Link href="/bundles" className={nav}>Bundles</Link>
              <Link href="/quiz" className={nav}>Skin quiz</Link>
            </nav>
          </div>
          <Link href="/" aria-label="Melaré home" className="block">
            <Image src="/logo.svg" alt="Melaré" width={128} height={56} priority className="h-9 w-auto lg:h-11" />
          </Link>
          <div className="flex items-center justify-end">
            <Link href="/journal" className={`${nav} mr-3 hidden lg:block`}>Journal</Link>
            <SearchSheet />
            <Suspense fallback={<span className="flex size-11 items-center justify-center"><UserIcon /></span>}><AccountLink /></Suspense>
            <Suspense fallback={<span className="flex size-11 items-center justify-center"><BagIcon /></span>}><BagLink /></Suspense>
          </div>
        </div>
      </header>
    </>
  );
}
