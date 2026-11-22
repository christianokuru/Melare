import Image from "next/image";
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-screen-sm flex-1 flex-col items-center justify-center gap-6 px-4 py-16 text-center md:max-w-screen-md">
      <Image src="/logo.svg" alt="Melaré" width={280} height={124} priority className="h-auto w-56 md:w-72" />
      <h1 className="font-heading text-3xl text-primary md:text-5xl">Skin, but rarer.</h1>
      <p className="max-w-prose text-muted-foreground">
        Thoughtful skincare for rich, glowing skin. Coming soon.
      </p>
      <Link href="/shop" className={cn(buttonVariants({ size: "lg" }), "w-full sm:w-auto")}>
        Shop the collection
      </Link>
    </main>
  );
}
