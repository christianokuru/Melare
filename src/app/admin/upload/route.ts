import { z } from "zod";
import { getSession, isAdmin } from "@/lib/auth";
import { MEDIA_FOLDERS } from "@/lib/media";
import { MAX_UPLOAD_BYTES, storeImage, UploadError } from "@/lib/storage";
import { throttle } from "@/lib/throttle";

const json = (body: object, status = 200) => Response.json(body, { status });

/**
 * Admin image upload (a route, so server actions can keep Next's default 1 MB body limit).
 * Route handlers don't get Server Actions' origin check, so CSRF is blocked here explicitly.
 */
export async function POST(req: Request) {
  const session = await getSession();
  if (!isAdmin(session?.user)) return new Response("Not found", { status: 404 });
  const origin = req.headers.get("origin");
  if (!origin || new URL(origin).host !== req.headers.get("host")) return json({ ok: false, error: "Bad origin" }, 403);
  if (Number(req.headers.get("content-length") ?? 0) > MAX_UPLOAD_BYTES + 64 * 1024) return json({ ok: false, error: "Image is larger than 4 MB." }, 413);
  if (!(await throttle("upload", 60, 3600, session!.user.id))) return json({ ok: false, error: "Too many uploads. Try again later." }, 429);
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  const folder = z.enum(MEDIA_FOLDERS).safeParse(form?.get("folder"));
  if (!(file instanceof File) || !folder.success) return json({ ok: false, error: "Choose an image to upload." }, 400);
  if (file.size > MAX_UPLOAD_BYTES) return json({ ok: false, error: "Image is larger than 4 MB." }, 413);
  try {
    return json({ ok: true, url: await storeImage(Buffer.from(await file.arrayBuffer()), folder.data) });
  } catch (e) {
    if (e instanceof UploadError) return json({ ok: false, error: e.message }, 400);
    console.error("[upload]", e);
    return json({ ok: false, error: "Upload failed. Please try again." }, 500);
  }
}
