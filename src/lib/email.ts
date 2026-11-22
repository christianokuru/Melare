import "server-only";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

/** Branded email shell. `body` must already be escaped HTML. */
function layout(title: string, body: string, cta?: { label: string; url: string }) {
  return `<!doctype html><html><body style="margin:0;background:#FBF7F3;font-family:Helvetica,Arial,sans-serif;color:#3B2418">
<table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table width="100%" style="max-width:520px;background:#fff;border-radius:16px;padding:32px">
<tr><td style="font-family:Georgia,serif;font-size:28px;text-align:center;padding-bottom:8px">melaré</td></tr>
<tr><td style="font-family:Georgia,serif;font-size:22px;padding:16px 0 8px">${escape(title)}</td></tr>
<tr><td style="font-size:15px;line-height:1.6">${body}</td></tr>
${cta ? `<tr><td style="padding:24px 0"><a href="${cta.url}" style="background:#3B2418;color:#FBF7F3;text-decoration:none;padding:14px 28px;border-radius:999px;font-size:13px;letter-spacing:.1em;text-transform:uppercase">${escape(cta.label)}</a></td></tr>` : ""}
<tr><td style="font-size:12px;color:#6B5045;padding-top:16px">Melaré · Skin, but rarer. · <a href="${APP_URL}" style="color:#6B5045">${APP_URL.replace(/^https?:\/\//, "")}</a></td></tr>
</table></td></tr></table></body></html>`;
}

export async function sendEmail(to: string, subject: string, title: string, body: string, cta?: { label: string; url: string }) {
  const html = layout(title, body, cta);
  if (!process.env.RESEND_API_KEY) {
    console.info(`[email:dev] to=${to} subject="${subject}"${cta ? ` link=${cta.url}` : ""}`);
    return;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM ?? "Melaré <onboarding@resend.dev>", to, subject, html }),
  });
  if (!res.ok) console.error("[email] send failed", res.status, await res.text().catch(() => ""));
}

export { escape as escapeHtml, APP_URL };
