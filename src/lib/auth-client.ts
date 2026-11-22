import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

/** Only same-site relative paths are allowed as post-auth redirects (prevents open redirects). */
export const safeNext = (n: string | null | undefined, fallback = "/account") =>
  n && n.startsWith("/") && !n.startsWith("//") && !n.includes("\\") ? n : fallback;
