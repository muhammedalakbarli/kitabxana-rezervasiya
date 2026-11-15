import crypto from "node:crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // qarışıq simvollar (0/O, 1/I) çıxarılıb

/** QR və əl ilə daxil etmə üçün qısa, oxunaqlı token */
export function qrToken(length = 10): string {
  const bytes = crypto.randomBytes(length);
  let s = "";
  for (let i = 0; i < length; i++) s += ALPHABET[bytes[i] % ALPHABET.length];
  return s;
}

export function slugify(s: string): string {
  const map: Record<string, string> = { ə: "e", ı: "i", ö: "o", ü: "u", ğ: "g", ş: "s", ç: "c", İ: "i", Ə: "e" };
  return s
    .replace(/[əıöüğşçİƏ]/g, (c) => map[c] ?? c)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}
