import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { PageTitle } from "@/components/admin/ui";
import { SettingsForm } from "./settings-form";

export const instant = false;
export const metadata = { title: "Settings" };

export default async function AdminSettings() {
  await requireAdmin();
  return (
    <div className="max-w-2xl">
      <PageTitle title="Settings" />
      <SettingsForm initial={await getSettings()} />
      <p className="mt-8 text-sm text-muted-foreground">Delivery fees and free-delivery thresholds are set per zone in <a href="/admin/shipping" className="underline">Shipping</a>. Remember to update the announcement if you change them.</p>
    </div>
  );
}
