import "server-only";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { media, type MediaFolder } from "./media";

const s3 = new S3Client({
  region: process.env.NEON_STORAGE_REGION,
  endpoint: process.env.NEON_STORAGE_ENDPOINT,
  credentials: { accessKeyId: process.env.NEON_STORAGE_ACCESS_KEY_ID!, secretAccessKey: process.env.NEON_STORAGE_SECRET_ACCESS_KEY! },
  forcePathStyle: true, // Neon Object Storage is path-style only
  requestChecksumCalculation: "WHEN_REQUIRED",
});

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // stays under Vercel's 4.5 MB request limit
const ALLOWED = new Set(["jpeg", "png", "webp", "avif"]);

export class UploadError extends Error {}

/**
 * Decodes the bytes as an image (rejecting anything that isn't one), strips metadata such as GPS,
 * resizes to ≤1800px wide, encodes WebP and stores it under an unguessable key. Returns the public URL.
 */
export async function storeImage(bytes: Buffer, folder: MediaFolder) {
  if (bytes.length > MAX_UPLOAD_BYTES) throw new UploadError("Image is larger than 4 MB.");
  const meta = await sharp(bytes).metadata().catch(() => null);
  if (!meta?.format || !ALLOWED.has(meta.format)) throw new UploadError("Upload a JPG, PNG, WebP or AVIF image.");
  if ((meta.width ?? 0) < 400) throw new UploadError("Image is too small. Use at least 400px wide.");
  const webp = await sharp(bytes).rotate().resize({ width: 1800, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
  return putObject(`${folder}/${crypto.randomUUID()}.webp`, webp);
}

export async function putObject(key: string, body: Buffer, contentType = "image/webp") {
  await s3.send(new PutObjectCommand({
    Bucket: process.env.NEON_STORAGE_BUCKET, Key: key, Body: body, ContentType: contentType,
    CacheControl: "public, max-age=31536000, immutable", // keys are unique, so objects never change
  }));
  return media(key);
}
