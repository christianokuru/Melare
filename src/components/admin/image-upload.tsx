"use client";
import { useRef, useTransition } from "react";
import { toast } from "sonner";
import type { MediaFolder } from "@/lib/media";

const MAX = 4 * 1024 * 1024;

/** Uploads to Neon Object Storage via the server (validated, resized, WebP). `name` adds a hidden input for plain forms. */
export function ImageUpload({ value, onChange, folder, name }: { value: string; onChange: (url: string) => void; folder: MediaFolder; name?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      {value ? <img src={value} alt="" className="h-20 w-16 shrink-0 rounded-md bg-sand object-cover" /> : <div className="h-20 w-16 shrink-0 rounded-md bg-sand" />}
      {name && <input type="hidden" name={name} value={value} />}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,image/avif" className="sr-only" aria-label="Choose image"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          if (file.size > MAX) return void toast.error("Image is larger than 4 MB.");
          const form = new FormData();
          form.set("file", file);
          form.set("folder", folder);
          start(async () => {
            const r: { ok: true; url: string } | { ok: false; error: string } = await fetch("/admin/upload", { method: "POST", body: form })
              .then((res) => res.json()).catch(() => ({ ok: false, error: "Upload failed. Please try again." }));
            if (r.ok) { onChange(r.url); toast.success("Image uploaded"); } else toast.error(r.error);
          });
        }} />
      <button type="button" disabled={pending} onClick={() => input.current?.click()}
        className="h-10 rounded-full border border-foreground/30 px-4 text-xs uppercase tracking-[0.12em] disabled:opacity-50">
        {pending ? "Uploading…" : value ? "Replace" : "Upload"}
      </button>
    </div>
  );
}
