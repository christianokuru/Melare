import Link from "next/link";
import { sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { requireUser } from "@/lib/auth";
import { SettingsForms } from "./settings-forms";

// Fresh session check on every request, so this route blocks rather than prefetching.
export const instant = false;

export default async function SettingsPage() {
  const { user } = await requireUser("/account/settings");
  const [subscribed] = await db.select({ email: s.subscribers.email }).from(s.subscribers).where(sql`lower(${s.subscribers.email}) = ${user.email.toLowerCase()}`);
  return (
    <div className="grid gap-10">
      <Link href="/account/addresses" className="flex max-w-xl items-center justify-between rounded-2xl border p-5 text-sm hover:bg-blush lg:hidden">
        <span><span className="block font-medium">Addresses</span><span className="text-muted-foreground">Saved delivery addresses for faster checkout</span></span><span aria-hidden>→</span>
      </Link>
      <SettingsForms name={user.name} phone={user.phone ?? ""} email={user.email} marketing={!!subscribed} />
    </div>
  );
}
