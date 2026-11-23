import "server-only";
import { sendNotification, setVapidDetails } from "web-push"; // v4: ESM, named exports (v3 used the deprecated url.parse)
import { and, eq, sql } from "drizzle-orm";
import { db, schema as s } from "@/db";

export const PUSH_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";
export const pushEnabled = () => !!(PUSH_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);

// Browsers' push services. The server only ever POSTs to these (no SSRF via a crafted endpoint).
const PUSH_HOSTS = [/^fcm\.googleapis\.com$/, /^updates\.push\.services\.mozilla\.com$/, /\.push\.apple\.com$/, /\.notify\.windows\.com$/];
export const isPushEndpoint = (url: string) => {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && PUSH_HOSTS.some((h) => h.test(u.hostname));
  } catch { return false; }
};

/** Sends a notification to the current admin's devices. Never throws; drops expired subscriptions. */
export async function pushToAdmin(payload: { title: string; body: string; url: string }) {
  const admin = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  if (!pushEnabled() || !admin) return;
  setVapidDetails(process.env.VAPID_SUBJECT || "mailto:admin@example.com", PUSH_PUBLIC_KEY, process.env.VAPID_PRIVATE_KEY!);
  const subs = await db.select({ endpoint: s.pushSubscriptions.endpoint, p256dh: s.pushSubscriptions.p256dh, auth: s.pushSubscriptions.auth })
    .from(s.pushSubscriptions).innerJoin(s.user, eq(s.user.id, s.pushSubscriptions.userId))
    .where(and(sql`lower(${s.user.email}) = ${admin}`, eq(s.user.emailVerified, true)));
  await Promise.allSettled(subs.map(async (sub) => {
    try {
      await sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify(payload), { TTL: 86400, urgency: "high" });
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) await db.delete(s.pushSubscriptions).where(eq(s.pushSubscriptions.endpoint, sub.endpoint));
      else console.error("[push]", code ?? e);
    }
  }));
}
