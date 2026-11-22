import { requireUser } from "@/lib/auth";
import { SettingsForms } from "./settings-forms";

export default async function SettingsPage() {
  const { user } = await requireUser("/account/settings");
  return <SettingsForms name={user.name} phone={user.phone ?? ""} email={user.email} />;
}
