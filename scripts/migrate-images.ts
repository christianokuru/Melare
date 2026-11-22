// One-off: upload public/images/* to Neon Object Storage (site/<name>.webp) and repoint DB rows.
// Idempotent: re-running overwrites the same keys and only rewrites rows still using /images/.
import { config } from "dotenv";
import { readdirSync, readFileSync } from "node:fs";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Pool } from "@neondatabase/serverless";
import sharp from "sharp";

config({ path: ".env.local", quiet: true });
const base = process.env.NEXT_PUBLIC_MEDIA_URL!.replace(/\/$/, "");
const s3 = new S3Client({
  region: process.env.NEON_STORAGE_REGION, endpoint: process.env.NEON_STORAGE_ENDPOINT, forcePathStyle: true, requestChecksumCalculation: "WHEN_REQUIRED",
  credentials: { accessKeyId: process.env.NEON_STORAGE_ACCESS_KEY_ID!, secretAccessKey: process.env.NEON_STORAGE_SECRET_ACCESS_KEY! },
});

async function main() {
  const dir = "public/images";
  for (const name of readdirSync(dir).filter((f) => /\.(webp|jpe?g|png)$/.test(f))) {
    const key = `site/${name.replace(/\.\w+$/, "")}.webp`;
    const body = await sharp(readFileSync(`${dir}/${name}`)).rotate().resize({ width: 1800, withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    await s3.send(new PutObjectCommand({ Bucket: process.env.NEON_STORAGE_BUCKET, Key: key, Body: body, ContentType: "image/webp", CacheControl: "public, max-age=31536000, immutable" }));
    console.log("uploaded", key, `${Math.round(body.length / 1024)} KB`);
  }
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const fix = (table: string, col: string) =>
    pool.query(`update ${table} set ${col} = $1 || regexp_replace(${col}, '^/images/([^.]+)\\.\\w+$', '\\1') || '.webp' where ${col} like '/images/%'`, [`${base}/site/`]);
  for (const [t, c] of [["product_images", "src"], ["categories", "image"], ["bundles", "image"]] as const) console.log(t, (await fix(t, c)).rowCount, "rows");
  await pool.end();
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
