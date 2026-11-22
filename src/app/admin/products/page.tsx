import Image from "next/image";
import Link from "next/link";
import { and, asc, eq, ilike, inArray, or, type SQL } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { formatMoney } from "@/lib/money";
import { EmptyState, PageTitle, Table, td, adminButton, adminInput, adminLabel } from "@/components/admin/ui";
import { StockEditor } from "./stock-editor";

// Fresh admin check on every request, so this route blocks rather than prefetching.
export const instant = false;

const STATUSES = ["active", "draft", "archived"] as const;

export default async function AdminProducts({ searchParams }: PageProps<"/admin/products">) {
  await requireAdmin();
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim().slice(0, 80) : "";
  const status = STATUSES.find((x) => x === sp.status);
  const categories = await db.select({ id: s.categories.id, name: s.categories.name }).from(s.categories).orderBy(asc(s.categories.position));
  const category = categories.find((c) => c.id === sp.category)?.id;

  const where: SQL[] = [];
  if (q) { const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`; where.push(or(ilike(s.products.name, like), ilike(s.products.slug, like))!); }
  if (status) where.push(eq(s.products.status, status));
  if (category) where.push(eq(s.products.categoryId, category));
  const products = await db.select({ id: s.products.id, name: s.products.name, slug: s.products.slug, status: s.products.status, featured: s.products.featured, category: s.categories.name })
    .from(s.products).leftJoin(s.categories, eq(s.categories.id, s.products.categoryId)).where(where.length ? and(...where) : undefined).orderBy(asc(s.products.name));
  const ids = products.map((p) => p.id);
  const [variants, images] = ids.length ? await Promise.all([
    db.select({ id: s.productVariants.id, productId: s.productVariants.productId, label: s.productVariants.label, stock: s.productVariants.stock, priceNgn: s.productVariants.priceNgn })
      .from(s.productVariants).where(inArray(s.productVariants.productId, ids)).orderBy(asc(s.productVariants.position)),
    db.selectDistinctOn([s.productImages.productId], { productId: s.productImages.productId, src: s.productImages.src })
      .from(s.productImages).where(inArray(s.productImages.productId, ids)).orderBy(s.productImages.productId, asc(s.productImages.position)),
  ]) : [[], []];

  return (
    <>
      <PageTitle title="Products" action={{ label: "New product", href: "/admin/products/new" }} />
      <form className="mb-4 flex flex-wrap items-end gap-2" action="/admin/products">
        <div className="w-full sm:w-72"><label htmlFor="pq" className={adminLabel}>Search</label><input id="pq" name="q" defaultValue={q} placeholder="Name or slug" className={adminInput} /></div>
        <div><label htmlFor="pstatus" className={adminLabel}>Status</label>
          <select id="pstatus" name="status" defaultValue={status ?? ""} className={adminInput}><option value="">All</option>{STATUSES.map((x) => <option key={x} value={x}>{x[0].toUpperCase() + x.slice(1)}</option>)}</select></div>
        <div><label htmlFor="pcat" className={adminLabel}>Category</label>
          <select id="pcat" name="category" defaultValue={category ?? ""} className={adminInput}><option value="">All</option>{categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
        <button type="submit" className={adminButton}>Filter</button>
        {(q || status || category) && <Link href="/admin/products" className="h-10 px-2 py-2.5 text-xs underline">Clear</Link>}
      </form>
      {products.length ? (
        <Table head={["", "Product", "Status", "From", "Stock (edit inline)"]}>
          {products.map((p) => {
            const vs = variants.filter((v) => v.productId === p.id);
            const img = images.find((i) => i.productId === p.id)?.src;
            const from = Math.min(...vs.map((v) => v.priceNgn));
            return (
              <tr key={p.id}>
                <td className={`${td} w-16`}>{img && <Image src={img} alt="" width={44} height={55} className="h-[55px] w-11 rounded-md object-cover" />}</td>
                <td className={td}>
                  <Link href={`/admin/products/${p.id}`} className="underline underline-offset-4">{p.name}</Link>{p.featured && <span className="ml-2 text-xs text-gold">★ featured</span>}
                  <span className="block text-xs text-muted-foreground">{p.category ?? "No category"} · /products/{p.slug}</span>
                </td>
                <td className={td}><span className={`rounded-full px-2.5 py-1 text-xs ${p.status === "active" ? "bg-[#e3eedf]" : "bg-muted text-muted-foreground"}`}>{p.status}</span></td>
                <td className={td}>{vs.length ? formatMoney(from, "NGN") : "-"}</td>
                <td className={td}><StockEditor variants={vs} /></td>
              </tr>
            );
          })}
        </Table>
      ) : <EmptyState>{q || status || category ? "No products match these filters." : "No products yet. Add your first product."}</EmptyState>}
    </>
  );
}
