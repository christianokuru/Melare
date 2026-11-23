import { z } from "zod";
import { suppress } from "@/lib/email";
import { verifyEmailToken } from "@/lib/email-tokens";

// RFC 8058 one-click unsubscribe (Gmail/Yahoo "Unsubscribe" button POSTs here). Signed token = only that address.
export async function POST(req: Request) {
  const url = new URL(req.url);
  const e = z.string().email().max(254).safeParse(url.searchParams.get("e"));
  if (!e.success || !verifyEmailToken("unsubscribe", e.data, url.searchParams.get("t") ?? "")) return new Response("Invalid link", { status: 400 });
  await suppress(e.data, "one-click");
  return new Response("Unsubscribed");
}
