"use client";
import { useSyncExternalStore } from "react";

export type Consent = "granted" | "denied" | null;
const KEY = "melare-consent";
const EVENT = "melare-consent-change";

function read(): Consent {
  try {
    const v = localStorage.getItem(KEY);
    return v === "granted" || v === "denied" ? v : null;
  } catch {
    return null; // storage blocked: treat as undecided, analytics stay off
  }
}

export function setConsent(v: Exclude<Consent, null> | null) {
  try {
    if (v) localStorage.setItem(KEY, v);
    else localStorage.removeItem(KEY);
  } catch { /* ignore */ }
  window.dispatchEvent(new Event(EVENT));
}

const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener("storage", cb); };
};

/** Hydration-safe consent state. `undefined` on the server / first render. */
export const useConsent = () => useSyncExternalStore<Consent | undefined>(subscribe, read, () => undefined);
