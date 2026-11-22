import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { presignUpload, publicUrl } from "@/lib/r2";

const Body = z.object({
  folder: z.enum(["products", "categories", "banners"]),
  contentType: z.enum(["image/webp", "image/jpeg", "image/png", "image/avif"]),
});

// POST /api/uploads → { uploadUrl, key, url }. Client then PUTs the file to uploadUrl.
export async function POST(req: Request) {
  try { await requireAdmin(); } catch (r) { return r as Response; }
  const parsed = Body.safeParse(await req.json());
  if (!parsed.success) return Response.json({ error: "Invalid body" }, { status: 400 });
  const { folder, contentType } = parsed.data;
  const key = `${folder}/${crypto.randomUUID()}.${contentType.split("/")[1]}`;
  return Response.json({ uploadUrl: await presignUpload(key, contentType), key, url: publicUrl(key) });
}
