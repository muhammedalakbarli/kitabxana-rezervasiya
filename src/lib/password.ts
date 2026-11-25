/**
 * Şifrə hash-ləmə — Node.js daxili scrypt (əlavə asılılıq yoxdur).
 * Format: scrypt$N$r$p$salt(b64)$hash(b64)
 */
import crypto from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(crypto.scrypt) as (pw: string, salt: Buffer, keylen: number, opts: crypto.ScryptOptions) => Promise<Buffer>;
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(16);
  const hash = await scrypt(password.normalize("NFKC"), salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${hash.toString("base64")}`;
}

export async function verifyPassword(password: string, stored: string | null | undefined): Promise<boolean> {
  if (!stored) return false;
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, hashB64] = parts;
  const expected = Buffer.from(hashB64, "base64");
  const actual = await scrypt(password.normalize("NFKC"), Buffer.from(saltB64, "base64"), expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024,
  });
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

/** Şifrə siyasəti: ən azı 8 simvol, hərf və rəqəm */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return "Şifrə ən azı 8 simvoldan ibarət olmalıdır.";
  if (pw.length > 128) return "Şifrə çox uzundur.";
  if (!/[A-Za-zƏəÖöÜüĞğİıŞşÇç]/.test(pw) || !/\d/.test(pw)) return "Şifrədə həm hərf, həm də rəqəm olmalıdır.";
  return null;
}

/** Admin tərəfindən verilən müvəqqəti şifrə (oxunaqlı, qarışıq simvollar yoxdur) */
export function temporaryPassword(): string {
  const letters = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const pick = (set: string, n: number) => Array.from(crypto.randomBytes(n), (b) => set[b % set.length]).join("");
  return `${pick(letters, 4)}-${pick(digits, 4)}-${pick(letters, 4)}`;
}
