import "server-only";
import { sql } from "drizzle-orm";
import { db, schema as s } from "@/db";
import { oneClickUnsubscribeUrl, unsubscribeUrl } from "./email-tokens";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Branded email shell. `body` must already be escaped HTML. */
function layout(title: string, body: string, cta?: { label: string; url: string }, unsubscribe?: string) {
  return `<!doctype html><html><body style="margin:0;background:#FBF7F3;font-family:Helvetica,Arial,sans-serif;color:#3B2418">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" style="max-width:520px;background:#fff;border-radius:16px;padding:32px">
<tr><td style="font-family:Georgia,serif;font-size:28px;text-align:center;padding-bottom:8px">melaré</td></tr>
<tr><td style="font-family:Georgia,serif;font-size:22px;padding:16px 0 8px">${escape(title)}</td></tr>
<tr><td style="font-size:15px;line-height:1.6">${body}</td></tr>
${cta ? `<tr><td style="padding:24px 0"><a href="${cta.url}" style="background:#3B2418;color:#FBF7F3;text-decoration:none;padding:14px 28px;border-radius:999px;font-size:13px;letter-spacing:.1em;text-transform:uppercase">${escape(cta.label)}</a></td></tr>` : ""}
<tr><td style="font-size:12px;color:#6B5045;padding-top:16px">Melaré · Skin, but rarer. · <a href="${APP_URL}" style="color:#6B5045">${APP_URL.replace(/^https?:\/\//, "")}</a>${unsubscribe ? ` · <a href="${unsubscribe}" style="color:#6B5045">Unsubscribe</a>` : ""}</td></tr>
</table></td></tr></table></body></html>`;
}

/** Unsubscribe: no more marketing email, and off the newsletter. */
export async function suppress(email: string, reason: string) {
  const e = email.trim().toLowerCase();
  await db.insert(s.emailSuppressions).values({ email: e, reason: reason.slice(0, 40) }).onConflictDoNothing();
  await db.delete(s.subscribers).where(sql`lower(${s.subscribers.email}) = ${e}`);
}
export const unsuppress = (email: string) => db.delete(s.emailSuppressions).where(sql`${s.emailSuppressions.email} = ${email.trim().toLowerCase()}`);

export const isSuppressed = async (email: string) =>
  (await db.select({ email: s.emailSuppressions.email }).from(s.emailSuppressions).where(sql`${s.emailSuppressions.email} = ${email.toLowerCase()}`)).length > 0;

/**
 * `marketing` emails (newsletter, quiz, reminders, restock): skipped for unsubscribed addresses, and carry an
 * unsubscribe link + one-click List-Unsubscribe headers (Gmail/Yahoo requirement, NDPA/CAN-SPAM).
 */
export async function sendEmail(to: string, subject: string, title: string, body: string, cta?: { label: string; url: string }, opts: { marketing?: boolean } = {}) {
  if (opts.marketing && (await isSuppressed(to))) return;
  const unsubscribe = opts.marketing ? unsubscribeUrl(to) : undefined;
  const html = layout(title, body, cta, unsubscribe);
  const headers = opts.marketing ? { "List-Unsubscribe": `<${oneClickUnsubscribeUrl(to)}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" } : undefined;
  if (!process.env.RESEND_API_KEY) {
    console.info(`[email:dev] to=${to} subject="${subject}"${cta ? ` link=${cta.url}` : ""}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "Melaré <onboarding@resend.dev>", to, subject, html, ...(headers && { headers }) }),
  });
  if (!res.ok) console.error("[email] send failed", res.status, await res.text().catch(() => ""));
}

export { escape as escapeHtml, APP_URL };
