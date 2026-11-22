import { asc, desc, eq } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { AddressBook } from "./address-book";

// Fresh session check on every request, so this route blocks rather than prefetching.
export const instant = false;

export default async function AddressesPage() {
  const { user } = await requireUser("/account/addresses");
  const addresses = await db.select().from(s.addresses).where(eq(s.addresses.userId, user.id)).orderBy(desc(s.addresses.isDefault), asc(s.addresses.createdAt));
  return <AddressBook addresses={addresses.map(({ userId: _u, createdAt: _c, updatedAt: _d, ...a }) => a)} />;
}
