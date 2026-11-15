import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { User } from "@prisma/client";
import { db } from "./db";
import { env, isAllowedEmail, normalizeEmail } from "./env";
import { emailLayout, escapeHtml } from "./email-templates";
import { queueMail } from "./mail";
import { audit } from "./audit";

const COOKIE = "kr_session";
const SESSION_DAYS = 30;
const CODE_TTL_MIN = 10;
const MAX_CODE_ATTEMPTS = 5;

export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("base64url");

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

export function isStaff(u: Pick<User, "role"> | null | undefined) {
  return u?.role === "STAFF" || u?.role === "ADMIN";
}

// ── Sessiyalar ───────────────────────────────────────────────────────

export async function createSession(userId: string) {
  const token = randomToken();
  const h = await headers();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.session.create({
    data: {
      id: sha256(token),
      userId,
      expiresAt,
      ip: await clientIp(),
      userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
    },
  });
  (await cookies()).set(COOKIE, token, {
    httpOnly: true,
    secure: env.appUrl.startsWith("https://"),
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
  await db.user.update({ where: { id: userId }, data: { lastLoginAt: new Date() } });
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const s = await db.session.findUnique({ where: { id: sha256(token) }, include: { user: true } });
  if (!s || s.expiresAt < new Date()) return null;
  return s.user;
});

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { id: sha256(token) } });
  jar.delete(COOKIE);
}

export async function requireUser(opts: { allowIncompleteProfile?: boolean; next?: string } = {}): Promise<User> {
  const u = await getCurrentUser();
  if (!u) redirect(`/giris?next=${encodeURIComponent(opts.next ?? "/panel")}`);
  if (!opts.allowIncompleteProfile && !u.profileCompletedAt) {
    redirect(`/profil?ilk=1${opts.next ? `&next=${encodeURIComponent(opts.next)}` : ""}`);
  }
  return u;
}

export async function requireStaff(): Promise<User> {
  const u = await requireUser({ next: "/admin" });
  if (!isStaff(u)) redirect("/panel?err=" + encodeURIComponent("Bu bölməyə giriş icazəniz yoxdur."));
  return u;
}

export async function requireAdmin(): Promise<User> {
  const u = await requireUser({ next: "/admin" });
  if (u.role !== "ADMIN") redirect("/admin?err=" + encodeURIComponent("Bu əməliyyat yalnız administrator üçündür."));
  return u;
}

// ── İstifadəçinin yaradılması / yenilənməsi ──────────────────────────

export async function upsertUserOnLogin(
  emailRaw: string,
  extra: { name?: string | null; externalId?: string | null; department?: string | null } = {},
): Promise<User> {
  const email = normalizeEmail(emailRaw);
  const shouldBeAdmin = env.adminEmails.includes(email);
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return db.user.update({
      where: { id: existing.id },
      data: {
        role: shouldBeAdmin ? "ADMIN" : undefined,
        name: existing.name ?? extra.name ?? undefined,
        externalId: existing.externalId ?? extra.externalId ?? undefined,
        department: existing.department ?? extra.department ?? undefined,
      },
    });
  }
  const user = await db.user.create({
    data: {
      email,
      role: shouldBeAdmin ? "ADMIN" : "STUDENT",
      name: extra.name ?? null,
      externalId: extra.externalId ?? null,
      department: extra.department ?? null,
    },
  });
  await audit(user.id, "user.registered", "User", user.id, { email });
  return user;
}

// ── E-poçt kodu ilə giriş ────────────────────────────────────────────

const codeHash = (email: string, code: string) => sha256(`${email}:${code}:${env.authSecret}`);

export async function requestLoginCode(emailRaw: string): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const email = normalizeEmail(emailRaw);
  if (!isAllowedEmail(email)) {
    return { ok: false, error: `Yalnız universitet e-poçtu ilə daxil olmaq mümkündür (@${env.allowedDomains.join(", @")}).` };
  }
  const ip = await clientIp();
  const since = new Date(Date.now() - 15 * 60_000);
  const [byEmail, byIp] = await Promise.all([
    db.loginCode.count({ where: { email, createdAt: { gt: since } } }),
    ip ? db.loginCode.count({ where: { ip, createdAt: { gt: since } } }) : Promise.resolve(0),
  ]);
  if (byEmail >= 5 || byIp >= 30) {
    return { ok: false, error: "Çox sayda cəhd edildi. Bir neçə dəqiqə sonra yenidən yoxlayın." };
  }
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await db.loginCode.updateMany({ where: { email, consumedAt: null }, data: { consumedAt: new Date() } });
  await db.loginCode.create({
    data: { email, codeHash: codeHash(email, code), expiresAt: new Date(Date.now() + CODE_TTL_MIN * 60_000), ip },
  });
  const html = emailLayout({
    title: "Giriş kodunuz",
    intro: "Kitabxana rezervasiya sisteminə daxil olmaq üçün aşağıdakı kodu daxil edin.",
    bodyHtml: `<div style="margin:20px 0;padding:18px;border-radius:12px;background:#F0F3BF;text-align:center;font-size:32px;letter-spacing:10px;font-weight:700;color:#16423C">${escapeHtml(code)}</div>`,
    footnote: `Kod ${CODE_TTL_MIN} dəqiqə ərzində etibarlıdır. Bu sorğunu siz göndərməmisinizsə, məktuba məhəl qoymayın.`,
  });
  await queueMail(
    { to: email, subject: `Giriş kodu: ${code}`, html, text: `Giriş kodunuz: ${code}\nKod ${CODE_TTL_MIN} dəqiqə etibarlıdır.` },
    { await: true },
  );
  return { ok: true, email };
}

export async function verifyLoginCode(emailRaw: string, codeRaw: string): Promise<{ ok: true; user: User } | { ok: false; error: string }> {
  const email = normalizeEmail(emailRaw);
  const code = codeRaw.replace(/\D/g, "");
  if (!isAllowedEmail(email) || code.length !== 6) return { ok: false, error: "Kod 6 rəqəmdən ibarət olmalıdır." };
  const row = await db.loginCode.findFirst({
    where: { email, consumedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
  });
  if (!row) return { ok: false, error: "Kodun vaxtı bitib. Yeni kod istəyin." };
  if (row.attempts >= MAX_CODE_ATTEMPTS) return { ok: false, error: "Cəhdlərin sayı bitib. Yeni kod istəyin." };
  const a = Buffer.from(row.codeHash, "hex");
  const b = Buffer.from(codeHash(email, code), "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    await db.loginCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    const left = MAX_CODE_ATTEMPTS - row.attempts - 1;
    return { ok: false, error: left > 0 ? `Kod yanlışdır. Qalan cəhd: ${left}.` : "Kod yanlışdır. Yeni kod istəyin." };
  }
  await db.loginCode.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
  const user = await upsertUserOnLogin(email);
  return { ok: true, user };
}

/** Yönləndirmə üçün təhlükəsiz daxili yol */
export function safeNext(next: string | null | undefined, fallback = "/panel"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
