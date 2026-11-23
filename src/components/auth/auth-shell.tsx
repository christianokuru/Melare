import Image from "next/image";
import { media } from "@/lib/media";

/** Split auth layout: form left, photo right (photo becomes a short banner on mobile). */
export function AuthShell({ title, subtitle, image, alt, children }: {
  title: string; subtitle: string; image: string; alt: string; children: React.ReactNode;
}) {
  return (
    <div className="grid lg:min-h-[calc(100svh-120px)] lg:grid-cols-2">
      <div className="relative h-44 sm:h-60 lg:order-2 lg:h-auto">
        <Image src={media(image)} alt={alt} fill priority sizes="(min-width:1024px) 50vw, 100vw" className="object-cover object-[50%_30%]" />
        <div className="absolute inset-0 hidden bg-gradient-to-t from-black/45 via-black/5 to-transparent lg:block" />
        <div className="absolute inset-x-0 bottom-0 hidden p-12 text-white lg:block">
          <p className="font-heading text-5xl leading-none">Skin, but <em>rarer.</em></p>
          <p className="mt-3 max-w-sm text-sm text-white/85">Gentle, effective skincare made for melanin-rich skin.</p>
        </div>
      </div>
      <div className="relative -mt-6 flex justify-center rounded-t-3xl bg-background px-5 pt-9 pb-14 lg:order-1 lg:mt-0 lg:items-center lg:rounded-none lg:px-[6vw] lg:py-16">
        <div className="w-full max-w-md" data-clarity-mask="True">
          <p className="eyebrow mb-3 text-muted-foreground">Melaré account</p>
          <h1 className="font-heading text-[40px] leading-none lg:text-[52px]">{title}</h1>
          <p className="mt-3 mb-8 text-muted-foreground">{subtitle}</p>
          {children}
        </div>
      </div>
    </div>
  );
}
