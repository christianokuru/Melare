import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient();

/**
 * Only same-site relative paths are allowed as post-auth redirects (prevents open redirects).
 * Rejects `//host`, backslashes and ANY control/whitespace char: browsers strip tabs/newlines, so "/\t/evil.com" becomes "//evil.com".
 */
export const safeNext = (n: string | null | undefined, fallback = "/account") => {
  if (!n || n.length > 512 || !n.startsWith("/") || n.startsWith("//") || /[\\\s\u0000-\u001f\u007f]/.test(n)) return fallback;
  try {
    const base = "https://safe.invalid";
    return new URL(n, base).origin === base ? n : fallback;
  } catch { return fallback; }
};
