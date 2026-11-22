"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SearchIcon } from "./icons";

export function SearchSheet() {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger render={<button type="button" aria-label="Search" className="flex size-11 items-center justify-center" />}><SearchIcon /></SheetTrigger>
      <SheetContent side="top" className="bg-background p-6">
        <SheetTitle className="sr-only">Search products</SheetTitle>
        <form role="search" className="mx-auto flex w-full max-w-2xl items-center gap-3 border-b border-foreground pb-2" onSubmit={(e) => {
          e.preventDefault();
          const q = String(new FormData(e.currentTarget).get("q") ?? "").trim().slice(0, 60);
          setOpen(false);
          router.push(q ? `/shop?q=${encodeURIComponent(q)}` : "/shop");
        }}>
          <SearchIcon />
          <label htmlFor="site-search" className="sr-only">Search</label>
          <input id="site-search" name="q" type="search" autoFocus maxLength={60} placeholder="Search serums, SPF, dark spots…" className="h-12 flex-1 bg-transparent text-lg outline-none placeholder:text-muted-foreground" />
        </form>
      </SheetContent>
    </Sheet>
  );
}
