import { Breadcrumbs, container } from "./section";

export function InfoPage({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <div className={`${container} pt-6`}>
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: title }]} />
      <div className="mx-auto mt-8 max-w-2xl">
        <h1 className="font-heading text-[40px] leading-none lg:text-6xl">{title}</h1>
        {intro && <p className="mt-4 text-lg text-muted-foreground">{intro}</p>}
        <div className="prose-melare mt-10 grid gap-6 text-[16px] leading-[1.75] [&_h2]:mt-4 [&_h2]:font-heading [&_h2]:text-3xl [&_a]:underline [&_a]:underline-offset-4 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">{children}</div>
      </div>
    </div>
  );
}
