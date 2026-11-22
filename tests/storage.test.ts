import { afterAll, describe, expect, it } from "vitest";
import { DeleteObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { storeImage, UploadError } from "@/lib/storage";
import { isMediaUrl, MEDIA_URL } from "@/lib/media";

const png = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: "#F5E6E1" } }).png().toBuffer();

const created: string[] = [];
afterAll(async () => {
  const s3 = new S3Client({ region: process.env.NEON_STORAGE_REGION, endpoint: process.env.NEON_STORAGE_ENDPOINT, forcePathStyle: true,
    credentials: { accessKeyId: process.env.NEON_STORAGE_ACCESS_KEY_ID!, secretAccessKey: process.env.NEON_STORAGE_SECRET_ACCESS_KEY! } });
  for (const url of created) await s3.send(new DeleteObjectCommand({ Bucket: process.env.NEON_STORAGE_BUCKET, Key: url.slice(MEDIA_URL.length + 1) }));
});

describe("Neon Object Storage uploads", () => {
  it("rejects non-images, tiny and oversized files", async () => {
    await expect(storeImage(Buffer.from("<script>alert(1)</script>"), "products")).rejects.toBeInstanceOf(UploadError);
    await expect(storeImage(await png(100, 100), "products")).rejects.toThrow(/too small/);
    await expect(storeImage(Buffer.alloc(5 * 1024 * 1024), "products")).rejects.toThrow(/4 MB/);
  });

  it("stores a resized WebP that is publicly readable", async () => {
    const url = await storeImage(await png(2400, 1600), "products");
    created.push(url);
    expect(isMediaUrl(url)).toBe(true);
    const res = await fetch(url);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    const meta = await sharp(Buffer.from(await res.arrayBuffer())).metadata();
    expect(meta.width).toBe(1800);
  });

  it("only accepts URLs inside our bucket", () => {
    expect(isMediaUrl(`${MEDIA_URL}/products/abc-123.webp`)).toBe(true);
    expect(isMediaUrl("https://evil.example.com/x.webp")).toBe(false);
    expect(isMediaUrl(`${MEDIA_URL}/../secret.webp`)).toBe(false);
    expect(isMediaUrl(`${MEDIA_URL}/other/x.webp`)).toBe(false);
  });
});
