export { cn } from "cn"

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ" // no 0/O/1/I

/** Unguessable human-friendly code (crypto RNG). */
export function randomCode(length: number) {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("")
}

export const slugify = (s: string) =>
  s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
