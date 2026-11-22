import Image from "next/image";
import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { PageTitle, Table, td } from "@/components/admin/ui";

export default async function AdminProducts() {
  await requireAdmin();
  const rows = await db.select({
    id: s.products.id, name: s.products.name, slug: s.products.slug, status: s.products.status, featured: s.products.featured,
    price: sql<number>`min(${s.productVariants.priceNgn})::int`, stock: sql<number>`coalesce(sum(${s.productVariants.stock}),0)::int`,
    image: sql<string | null>`(select src from product_images i where i.product_id = ${s.products.id} order by position limit 1)`,
  }).from(s.products).leftJoin(s.productVariants, eq(s.productVariants.productId, s.products.id)).groupBy(s.products.id).orderBy(asc(s.products.name));
  return (
    <>
      <PageTitle title="Products" action={{ label: "New product", href: "/admin/products/new" }} />
      <Table head={["", "Product", "Status", "From", "Stock"]}>
        {rows.map((p) => (
          <tr key={p.id}>
            <td className={`${td} w-16`}>{p.image && <Image src={p.image} alt="" width={44} height={55} className="h-[55px] w-11 rounded-md object-cover" />}</td>
            <td className={td}><Link href={`/admin/products/${p.id}`} className="underline underline-offset-4">{p.name}</Link>{p.featured && <span className="ml-2 text-xs text-gold">★ featured</span>}<span className="block text-xs text-muted-foreground">/products/{p.slug}</span></td>
            <td className={td}>{p.status}</td><td className={td}>{p.price ? formatMoney(p.price, "NGN") : "-"}</td>
            <td className={`${td} ${p.stock <= 5 ? "text-destructive" : ""}`}>{p.stock}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}
