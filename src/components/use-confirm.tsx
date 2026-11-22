"use client";
import { useRef, useState } from "react";

/**
 * Styled replacement for window.confirm(). Usage:
 *   const [confirm, confirmDialog] = useConfirm();
 *   if (await confirm("Delete this?")) …;   …and render {confirmDialog}
 */
export function useConfirm() {
  const ref = useRef<HTMLDialogElement>(null);
  const [ask, setAsk] = useState<{ message: string; action: string; resolve: (ok: boolean) => void } | null>(null);
  const confirm = (message: string, action = "Confirm") => new Promise<boolean>((resolve) => {
    setAsk({ message, action, resolve });
    requestAnimationFrame(() => ref.current?.showModal());
  });
  const close = (ok: boolean) => { ref.current?.close(); ask?.resolve(ok); setAsk(null); };
  const dialog = (
    <dialog ref={ref} onCancel={(e) => { e.preventDefault(); close(false); }} aria-labelledby="confirm-msg"
      className="m-auto w-[min(92vw,420px)] rounded-2xl bg-background p-6 text-foreground shadow-xl backdrop:bg-black/40">
      <p id="confirm-msg" className="text-[15px] leading-relaxed">{ask?.message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button type="button" onClick={() => close(false)} className="h-10 rounded-full border border-foreground/30 px-5 text-xs uppercase tracking-[0.12em]">Cancel</button>
        <button type="button" autoFocus onClick={() => close(true)} className="h-10 rounded-full bg-foreground px-5 text-xs uppercase tracking-[0.12em] text-background">{ask?.action}</button>
      </div>
    </dialog>
  );
  return [confirm, dialog] as const;
}
