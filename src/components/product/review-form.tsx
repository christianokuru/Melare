"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { submitReview } from "@/app/actions/store";
import { SKIN_TYPES } from "@/lib/constants";
import { StarIcon } from "@/components/site/icons";
import { buttonOutline, buttonPrimary, inputClass, labelClass } from "@/components/site/section";

export function ReviewForm({ productId, signedIn, path }: { productId: string; signedIn: boolean; path: string }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  if (!signedIn) return <Link href={`/sign-in?next=${encodeURIComponent(path)}`} className={buttonOutline}>Sign in to write a review</Link>;
  if (msg?.ok) return <p className="rounded-xl bg-blush p-4 text-sm">{msg.text}</p>;
  if (!open) return <button type="button" className={buttonOutline} onClick={() => setOpen(true)}>Write a review</button>;
  return (
    <form className="grid w-full max-w-xl gap-4" onSubmit={(e) => {
      e.preventDefault();
      const f = new FormData(e.currentTarget);
      start(async () => {
        const r = await submitReview({ productId, rating, title: String(f.get("title")), body: String(f.get("body")), skinType: String(f.get("skinType")) as (typeof SKIN_TYPES)[number] });
        setMsg(r.ok ? { ok: true, text: "Thank you! Your review will appear once it’s approved." } : { ok: false, text: r.error });
      });
    }}>
      <fieldset>
        <legend className={labelClass}>Your rating</legend>
        <div className="flex text-gold">
          {[1, 2, 3, 4, 5].map((i) => (
            <button key={i} type="button" aria-label={`${i} star${i > 1 ? "s" : ""}`} aria-pressed={rating === i} onClick={() => setRating(i)} className="flex size-11 items-center justify-center">
              <StarIcon width={24} height={24} filled={rating >= i} />
            </button>
          ))}
        </div>
      </fieldset>
      <div><label htmlFor="rv-title" className={labelClass}>Title</label><input id="rv-title" name="title" required minLength={2} maxLength={80} className={inputClass} /></div>
      <div><label htmlFor="rv-body" className={labelClass}>Your review</label><textarea id="rv-body" name="body" required minLength={10} maxLength={1500} rows={4} className={`${inputClass} h-auto py-3`} /></div>
      <div>
        <label htmlFor="rv-skin" className={labelClass}>Your skin type</label>
        <select id="rv-skin" name="skinType" required className={inputClass}>{SKIN_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
      </div>
      {msg && !msg.ok && <p role="alert" className="text-sm text-destructive">{msg.text}</p>}
      <button type="submit" disabled={pending} className={buttonPrimary}>{pending ? "Submitting…" : "Submit review"}</button>
    </form>
  );
}
