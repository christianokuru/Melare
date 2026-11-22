import Link from "next/link";
import Image from "next/image";
import { buttonOutline, buttonPrimary } from "@/components/site/section";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-24 text-center">
      <Link href="/"><Image src="/logo.svg" alt="Melaré" width={140} height={62} className="h-12 w-auto" /></Link>
      <h1 className="mt-6 font-heading text-[44px] leading-none">Page not found</h1>
      <p className="max-w-md text-muted-foreground">The page you’re looking for has moved or doesn’t exist.</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row"><Link href="/shop" className={buttonPrimary}>Shop all</Link><Link href="/" className={buttonOutline}>Home</Link></div>
    </main>
  );
}
