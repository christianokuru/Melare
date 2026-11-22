"use client";
import { useTransition } from "react";
import { toastResult } from "@/lib/toast-result";
import { saveSettings } from "@/app/actions/admin";
import { adminButton, adminInput, adminLabel } from "@/components/admin/ui";

type S = { whatsapp: string; announcement: string; announcementMobile: string };

export function SettingsForm({ initial }: { initial: S }) {
  const [pending, start] = useTransition();
  return (
    <form className="grid gap-5 rounded-2xl border bg-white p-5" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      start(async () => {
        toastResult(await saveSettings({ whatsapp: String(f.get("whatsapp")), announcement: String(f.get("announcement")), announcementMobile: String(f.get("announcementMobile")) }), "Settings saved");
      });
    }}>
      <div>
        <label htmlFor="st-wa" className={adminLabel}>WhatsApp number (with country code, digits only)</label>
        <input id="st-wa" name="whatsapp" defaultValue={initial.whatsapp} inputMode="tel" placeholder="2348012345678" className={adminInput} />
        <p className="mt-1 text-xs text-muted-foreground">Used by every “Chat with us” button. Leave empty to send people to the contact page.</p>
      </div>
      <div>
        <label htmlFor="st-ann" className={adminLabel}>Top banner (desktop, up to 120 characters)</label>
        <input id="st-ann" name="announcement" defaultValue={initial.announcement} maxLength={120} className={adminInput} />
      </div>
      <div>
        <label htmlFor="st-annm" className={adminLabel}>Top banner (phones, up to 60 characters)</label>
        <input id="st-annm" name="announcementMobile" defaultValue={initial.announcementMobile} maxLength={60} className={adminInput} />
      </div>
      <button type="submit" disabled={pending} className={`${adminButton} w-fit`}>{pending ? "Saving…" : "Save settings"}</button>
    </form>
  );
}
