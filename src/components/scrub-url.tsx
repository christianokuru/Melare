"use client";
import { useEffect } from "react";

/** Removes the query string (reset token, payment reference) from the address bar, history and anything that reads the URL later. */
export function ScrubUrl() {
  useEffect(() => {
    if (location.search) history.replaceState(history.state, "", location.pathname + location.hash);
  }, []);
  return null;
}
