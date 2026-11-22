import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { db, schema as s } from "@/db";

export const SETTINGS_TAG = "settings";

/** Store settings editable in /admin/settings. Empty values fall back to these defaults. */
export const SETTING_DEFAULTS = {
  whatsapp: process.env.NEXT_PUBLIC_WHATSAPP_NUMBER ?? "",
  announcement: "Free Lagos delivery over ₦50,000 · Ships worldwide",
  announcementMobile: "Free Lagos delivery over ₦50k",
};
export type Settings = typeof SETTING_DEFAULTS;
export type SettingKey = keyof Settings;

export async function getSettings(): Promise<Settings> {
  "use cache";
  cacheTag(SETTINGS_TAG);
  cacheLife("days");
  const rows = await db.select().from(s.settings);
  const saved = Object.fromEntries(rows.filter((r) => r.key in SETTING_DEFAULTS && r.value).map((r) => [r.key, r.value]));
  return { ...SETTING_DEFAULTS, ...saved };
}
