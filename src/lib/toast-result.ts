"use client";
import { toast } from "sonner";

/** Toast the outcome of a server action that returns { ok, error }. Returns ok. */
export function toastResult(r: { ok: true } | { ok: false; error: string }, success: string) {
  if (r.ok) toast.success(success);
  else toast.error(r.error);
  return r.ok;
}
