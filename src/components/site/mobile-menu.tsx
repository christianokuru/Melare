"use client";
import Link from "next/link";
import { useState } from "react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { MenuIcon } from "./icons";
import { CONCERNS } from "@/lib/constants";

export function MobileMenu({ categories, whatsapp }: { categories: { slug: string; name: string }[]; whatsapp: string }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  const item = "block py-2.5 text-[15px]";
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<button type="button" aria-label="Open menu" className="flex size-11 items-center justify-center lg:hidden" />}>
        <MenuIcon />
      </SheetTrigger>
      <SheetContent side="left" className="w-[86vw] max-w-sm overflow-y-auto bg-background p-6" data-lenis-prevent>
        <SheetTitle className="font-heading text-3xl font-normal">Menu</SheetTitle>
        <nav aria-label="Mobile" className="mt-6 flex flex-col gap-6">
          <div>
            <p className="eyebrow mb-1 text-muted-foreground">Shop</p>
            <Link href="/shop" onClick={close} className={item}>All products</Link>
            {categories.map((c) => <Link key={c.slug} href={`/shop/${c.slug}`} onClick={close} className={item}>{c.name}</Link>)}
            <Link href="/bundles" onClick={close} className={item}>Routine bundles</Link>
          </div>
          <div>
            <p className="eyebrow mb-1 text-muted-foreground">Shop by concern</p>
            {CONCERNS.map((c) => <Link key={c.slug} href={`/concerns/${c.slug}`} onClick={close} className={item}>{c.name}</Link>)}
          </div>
          <div className="border-t pt-4">
            <Link href="/quiz" onClick={close} className={item}>Skin quiz</Link>
            <Link href="/journal" onClick={close} className={item}>Journal</Link>
            <Link href="/account" onClick={close} className={item}>My account</Link>
            <Link href="/track" onClick={close} className={item}>Track an order</Link>
            <a href={whatsapp} className={item} target="_blank" rel="noopener noreferrer">Chat on WhatsApp</a>
          </div>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
