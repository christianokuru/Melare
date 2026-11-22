import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { z } from "zod";
import { db, schema as s } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { ProductForm } from "./product-form";

export default async function AdminProduct({ params }: PageProps<"/admin/products/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const categories = await db.select({ id: s.categories.id, name: s.categories.name }).from(s.categories).orderBy(asc(s.categories.position));
  if (id === "new") return <><Back /><ProductForm categories={categories} /></>;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [p] = await db.select().from(s.products).where(eq(s.products.id, id));
  if (!p) notFound();
  const [variants, images] = await Promise.all([
    db.select().from(s.productVariants).where(eq(s.productVariants.productId, id)).orderBy(asc(s.productVariants.position)),
    db.select().from(s.productImages).where(eq(s.productImages.productId, id)).orderBy(asc(s.productImages.position)),
  ]);
  return <><Back /><ProductForm categories={categories} product={{ ...p, variants, images }} /></>;
}

const Back = () => <Link href="/admin/products" className="eyebrow mb-4 inline-block underline underline-offset-4">← Products</Link>;
