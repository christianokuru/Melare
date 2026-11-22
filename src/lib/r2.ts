import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Cloudflare R2 is S3-compatible. Region must be "auto".
export const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
});

const Bucket = process.env.R2_BUCKET!;

/** Presigned PUT so the browser uploads straight to R2 (bypasses Vercel's 4.5MB body limit). */
export const presignUpload = (key: string, contentType: string) =>
  getSignedUrl(r2, new PutObjectCommand({ Bucket, Key: key, ContentType: contentType }), { expiresIn: 300 });

export const deleteObject = (key: string) => r2.send(new DeleteObjectCommand({ Bucket, Key: key }));

/** Public CDN URL (custom domain on the bucket, e.g. https://cdn.melare.com). */
export const publicUrl = (key: string) => `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`;
