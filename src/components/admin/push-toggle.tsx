"use client";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { toastResult } from "@/lib/toast-result";
import { removePushSubscription, savePushSubscription, sendTestPush } from "@/app/actions/admin";
import { adminButton, adminGhost } from "./ui";

type State = "loading" | "unsupported" | "denied" | "off" | "on";

const toKey = (b64: string) => {
  const raw = atob((b64 + "=".repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
};
const registration = () => navigator.serviceWorker.register("/sw.js").then(() => navigator.serviceWorker.ready);

/** Turns new-order alerts on/off for this device (Web Push via the site's service worker). */
export function PushToggle({ publicKey }: { publicKey: string }) {
  const [state, setState] = useState<State>("loading");
  const [pending, start] = useTransition();

  useEffect(() => {
    const check = async (): Promise<State> => {
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return "unsupported";
      if (Notification.permission === "denied") return "denied";
      return (await (await registration()).pushManager.getSubscription()) ? "on" : "off";
    };
    check().catch((): State => "unsupported").then(setState);
  }, []);

  const enable = () => start(async () => {
    if ((await Notification.requestPermission()) !== "granted") return void setState("denied");
    try {
      const reg = await registration();
      const sub = (await reg.pushManager.getSubscription()) ?? await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) });
      const r = await savePushSubscription(sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } });
      if (!r.ok) { await sub.unsubscribe(); return void toast.error(r.error); }
      setState("on");
      toast.success("New-order alerts are on for this device");
    } catch {
      toast.error("Couldn’t turn on notifications in this browser.");
    }
  });

  const disable = () => start(async () => {
    const sub = await (await registration()).pushManager.getSubscription();
    if (sub) { await removePushSubscription(sub.endpoint); await sub.unsubscribe(); }
    setState("off");
  });

  return (
    <section className="rounded-2xl border bg-white p-5">
      <h2 className="font-heading text-2xl">Order alerts</h2>
      <p className="mt-1 mb-4 text-sm text-muted-foreground">
        {state === "on" ? "This device gets a notification for every new paid order."
          : state === "denied" ? "Notifications are blocked for this site. Allow them in your browser settings, then reload."
          : state === "unsupported" ? "This browser doesn’t support notifications. On iPhone, add the site to your Home Screen first (Share → Add to Home Screen)."
          : "Get a notification on this device for every new paid order, even when the site is closed."}
      </p>
      {state === "off" && <button type="button" disabled={pending} onClick={enable} className={adminButton}>{pending ? "Turning on…" : "Turn on alerts"}</button>}
      {state === "on" && (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={() => start(async () => { toastResult(await sendTestPush(), "Test notification sent"); })} className={adminGhost}>Send test</button>
          <button type="button" disabled={pending} onClick={disable} className={adminGhost}>Turn off</button>
        </div>
      )}
    </section>
  );
}
