"use client";

/** Native share sheet where available (most phones), otherwise WhatsApp. */
export function ShareButton({ text, url }: { text: string; url: string }) {
  return (
    <button type="button" className="eyebrow rounded-full border border-foreground px-4 py-2.5"
      onClick={async () => {
        if (navigator.share) { try { await navigator.share({ text, url }); } catch { /* cancelled */ } return; }
        window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, "_blank", "noopener,noreferrer");
      }}>Share</button>
  );
}
