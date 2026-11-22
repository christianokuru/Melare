import { requireUser } from "@/lib/auth";
import { SettingsForms } from "./settings-forms";

// Fresh session check on every request, so this route blocks rather than prefetching.
export const instant = false;

export default async function SettingsPage() {
  const { user } = await requireUser("/account/settings");
  return <SettingsForms name={user.name} phone={user.phone ?? ""} email={user.email} />;
}
