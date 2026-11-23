"use client";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { toastResult } from "@/lib/toast-result";
import { setMarketingEmails, updateProfile } from "@/app/actions/account";
import { useConfirm } from "@/components/use-confirm";
import { authClient } from "@/lib/auth-client";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { buttonOutline, buttonPrimary, inputClass, labelClass } from "@/components/site/section";

export function SettingsForms({ name, phone, email, marketing }: { name: string; phone: string; email: string; marketing: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="grid max-w-xl gap-12">
      <form className="grid gap-4" onSubmit={(e) => {
        e.preventDefault();
        const f = new FormData(e.currentTarget);
        start(async () => { const r = await updateProfile({ name: String(f.get("name")), phone: String(f.get("phone")) }); toastResult(r, "Profile updated"); });
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
          <SignOutButton className={buttonOutline} />
          <SignOutButton className={buttonOutline} everywhere>Sign out everywhere</SignOutButton>
        </div>
      </div>

      <Privacy marketing={marketing} />
    </div>
  );
}

/** Marketing preferences, data download and account deletion (NDPA rights). */
function Privacy({ marketing }: { marketing: boolean }) {
  const router = useRouter();
  const [subscribed, setSubscribed] = useState(marketing);
  const [pending, start] = useTransition();
  const [confirm, confirmDialog] = useConfirm();
  return (
    <section className="grid gap-6" aria-labelledby="privacy">
      <h2 id="privacy" className="font-heading text-2xl">Privacy</h2>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" checked={subscribed} disabled={pending} className="mt-0.5 size-4 accent-foreground" onChange={(e) => {
          const next = e.target.checked;
          setSubscribed(next);
          start(async () => { if (!toastResult(await setMarketingEmails(next), next ? "You’re subscribed to offers" : "You won’t get marketing emails")) setSubscribed(!next); });
        }} />
        <span>Email me offers, launches, restock and reorder reminders.<span className="block text-muted-foreground">Order updates are always sent.</span></span>
      </label>
      <div className="text-sm">
        <p className="mb-2">Get a copy of everything we hold about you: profile, addresses, orders, reviews and quiz answers.</p>
        <a href="/account/export" download className={`${buttonOutline} w-fit`}>Download my data</a>
      </div>
      <form className="grid gap-3 rounded-2xl border border-destructive/30 p-5 text-sm" onSubmit={async (e) => {
        e.preventDefault();
        const password = String(new FormData(e.currentTarget).get("password"));
        if (!(await confirm("Delete your account permanently? Your saved addresses, favourites, reviews and rewards will be removed. This can’t be undone.", "Delete account"))) return;
        start(async () => {
          const { error } = await authClient.deleteUser({ password });
          if (error) return void toast.error(error.status === 429 ? "Too many attempts. Try again later." : error.message?.includes("admin") ? error.message : "Your password is incorrect.");
          toast.success("Your account has been deleted.");
          router.push("/");
          router.refresh();
        });
      }}>
        <p className="font-medium">Delete account</p>
        <p className="text-muted-foreground">We keep records of past orders for tax and accounting, without linking them to an account.</p>
        <div><label className={labelClass} htmlFor="del-pw">Confirm with your password</label><input id="del-pw" name="password" type="password" required autoComplete="current-password" className={inputClass} /></div>
        <button type="submit" disabled={pending} className="h-12 w-fit rounded-full bg-destructive px-8 text-[12px] uppercase tracking-[0.14em] text-white disabled:opacity-50">Delete my account</button>
      </form>
      {confirmDialog}
    </section>
  );
}
