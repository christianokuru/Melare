"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { updateProfile } from "@/app/actions/account";
import { authClient } from "@/lib/auth-client";
import { buttonOutline, buttonPrimary, inputClass, labelClass } from "@/components/site/section";

export function SettingsForms({ name, phone, email }: { name: string; phone: string; email: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div className="grid max-w-xl gap-12">
      <form className="grid gap-4" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => { const r = await updateProfile({ name: String(f.get("name")), phone: String(f.get("phone")) }); r.ok ? toast.success("Profile updated") : toast.error(r.error); });
      }}>
        <h2 className="font-heading text-2xl">Profile</h2>
        <div><label className={labelClass} htmlFor="s-email">Email</label><input id="s-email" value={email} readOnly className={`${inputClass} bg-muted`} /></div>
        <div><label className={labelClass} htmlFor="s-name">Full name</label><input id="s-name" name="name" defaultValue={name} required minLength={2} maxLength={80} className={inputClass} /></div>
        <div><label className={labelClass} htmlFor="s-phone">Phone</label><input id="s-phone" name="phone" type="tel" defaultValue={phone} className={inputClass} /></div>
        <button type="submit" disabled={pending} className={`${buttonPrimary} w-fit`}>Save changes</button>
      </form>

      <form className="grid gap-4" onSubmit={(e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const f = new FormData(form);
        const next = String(f.get("new"));
        if (next.length < 8) return toast.error("Use at least 8 characters.");
        start(async () => {
          const { error } = await authClient.changePassword({ currentPassword: String(f.get("current")), newPassword: next, revokeOtherSessions: true });
          if (error) toast.error(error.status === 429 ? "Too many attempts. Try again later." : "Your current password is incorrect.");
          else { toast.success("Password changed. Other devices were signed out."); form.reset(); }
        });
      }}>
        <h2 className="font-heading text-2xl">Change password</h2>
        <div><label className={labelClass} htmlFor="s-current">Current password</label><input id="s-current" name="current" type="password" required autoComplete="current-password" className={inputClass} /></div>
        <div><label className={labelClass} htmlFor="s-new">New password</label><input id="s-new" name="new" type="password" required minLength={8} maxLength={128} autoComplete="new-password" className={inputClass} /></div>
        <button type="submit" disabled={pending} className={`${buttonPrimary} w-fit`}>Update password</button>
      </form>

      <div className="grid gap-3">
        <h2 className="font-heading text-2xl">Sign out</h2>
        <div className="flex flex-wrap gap-3">
          <button type="button" className={buttonOutline} onClick={() => start(async () => { await authClient.signOut(); router.push("/"); router.refresh(); })}>Sign out</button>
          <button type="button" className={buttonOutline} onClick={() => start(async () => { await authClient.revokeSessions(); router.push("/sign-in"); router.refresh(); })}>Sign out everywhere</button>
        </div>
      </div>
    </div>
  );
}
