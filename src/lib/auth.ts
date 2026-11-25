import crypto from "node:crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { User } from "@prisma/client";
import { db } from "./db";
import { env, normalizeEmail } from "./env";
import { emailLayout, escapeHtml } from "./email-templates";
import { queueMail } from "./mail";
import { audit } from "./audit";

const COOKIE = "kr_session";
const SCOPE_COOKIE = "kr_admin_scope";
const SESSION_DAYS = 30;
const CODE_TTL_MIN = 10;
const MAX_CODE_ATTEMPTS = 5;
const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;

export const sha256 = (s: string) => crypto.createHash("sha256").update(s).digest("hex");
export const randomToken = (bytes = 32) => crypto.randomBytes(bytes).toString("base64url");

export async function clientIp(): Promise<string | null> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

export const isStaff = (u: Pick<User, "role"> | null | undefined) => u?.role === "SUPERVISOR" || u?.role === "SUPERADMIN";
export const isSuperAdmin = (u: Pick<User, "role"> | null | undefined) => u?.role === "SUPERADMIN";

/** Real e-poçt göndərilirsə, qeydiyyat/şifrə bərpası e-poçt kodu ilə təsdiqlənir */
export const emailVerificationEnabled = () => env.mailMode === "smtp";

// ── Sessiyalar ───────────────────────────────────────────────────────

export async function createSession(userId: string) {
  const token = randomToken();
  const h = await headers();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await db.session.create({
    data: { id: sha256(token), userId, expiresAt, ip: await clientIp(), userAgent: h.get("user-agent")?.slice(0, 300) ?? null },
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
  jar.delete(SCOPE_COOKIE);
}

/** Bütün digər sessiyaları bağla (şifrə dəyişəndə) */
export async function destroyOtherSessions(userId: string) {
  const token = (await cookies()).get(COOKIE)?.value;
  await db.session.deleteMany({ where: { userId, ...(token ? { id: { not: sha256(token) } } : {}) } });
}

/** Yalnız giriş tələb edir. Profil tamamlanmayıbsa layout pəncərə göstərir. */
export async function requireUser(opts: { next?: string } = {}): Promise<User> {
  const u = await getCurrentUser();
  if (!u) redirect(`/giris?next=${encodeURIComponent(opts.next ?? "/panel")}`);
  return u;
}

export function profileReady(u: Pick<User, "profileCompletedAt" | "mustChangePassword">) {
  return Boolean(u.profileCompletedAt) && !u.mustChangePassword;
}

// ── Admin rolları və əhatə dairəsi ───────────────────────────────────

export type StaffContext = {
  user: User;
  superAdmin: boolean;
  /** null = bütün kitabxanalar (yalnız super admin) */
  libraryId: string | null;
};

export async function requireStaff(): Promise<StaffContext> {
  const user = await requireUser({ next: "/admin" });
  if (!isStaff(user)) redirect("/panel?err=" + encodeURIComponent("Bu bölməyə giriş icazəniz yoxdur."));
  if (user.role === "SUPERVISOR") {
    if (!user.libraryId) redirect("/panel?err=" + encodeURIComponent("Sizə hələ kitabxana təyin olunmayıb. Super admin ilə əlaqə saxlayın."));
    return { user, superAdmin: false, libraryId: user.libraryId };
  }
  const scope = (await cookies()).get(SCOPE_COOKIE)?.value;
  let libraryId: string | null = null;
  if (scope && scope !== "all") {
    const lib = await db.library.findFirst({ where: { id: scope, archivedAt: null }, select: { id: true } });
    libraryId = lib?.id ?? null;
  }
  return { user, superAdmin: true, libraryId };
}

export async function requireSuperAdmin(): Promise<StaffContext> {
  const ctx = await requireStaff();
  if (!ctx.superAdmin) redirect("/admin?err=" + encodeURIComponent("Bu əməliyyat yalnız super admin üçündür."));
  return ctx;
}

export async function setAdminScope(libraryId: string | null) {
  (await cookies()).set(SCOPE_COOKIE, libraryId ?? "all", { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
}

/** Supervayzer yalnız öz kitabxanasındakı obyektlərə toxuna bilər */
export function canAccessLibrary(ctx: StaffContext, libraryId: string) {
  return ctx.superAdmin || ctx.libraryId === libraryId;
}

// ── İstifadəçi (Microsoft SSO) ───────────────────────────────────────

export async function upsertUserOnLogin(
  emailRaw: string,
  extra: { name?: string | null; externalId?: string | null; department?: string | null } = {},
): Promise<User> {
  const email = normalizeEmail(emailRaw);
  const shouldBeAdmin = env.adminEmails.includes(email);
  const existing = await db.user.findUnique({ where: { email } });
  const [firstName, ...rest] = (extra.name ?? "").trim().split(/\s+/);
  if (existing) {
    return db.user.update({
      where: { id: existing.id },
      data: {
        role: shouldBeAdmin ? "SUPERADMIN" : undefined,
        name: existing.name ?? extra.name ?? undefined,
        firstName: existing.firstName ?? (firstName || undefined),
        lastName: existing.lastName ?? (rest.join(" ") || undefined),
        externalId: existing.externalId ?? extra.externalId ?? undefined,
        department: existing.department ?? extra.department ?? undefined,
        emailVerifiedAt: existing.emailVerifiedAt ?? new Date(),
      },
    });
  }
  const user = await db.user.create({
    data: {
      email,
      role: shouldBeAdmin ? "SUPERADMIN" : "STUDENT",
      name: extra.name ?? null,
      firstName: firstName || null,
      lastName: rest.join(" ") || null,
      externalId: extra.externalId ?? null,
      department: extra.department ?? null,
      emailVerifiedAt: new Date(),
    },
  });
  await audit(user.id, "user.registered", "User", user.id, { email, via: "microsoft" });
  return user;
}

// ── Giriş cəhdlərinin məhdudlaşdırılması ─────────────────────────────

export async function loginLocked(email: string): Promise<boolean> {
  const since = new Date(Date.now() - LOCK_MINUTES * 60_000);
  const ip = await clientIp();
  const [byEmail, byIp] = await Promise.all([
    db.loginAttempt.count({ where: { email, success: false, createdAt: { gt: since } } }),
    ip ? db.loginAttempt.count({ where: { ip, success: false, createdAt: { gt: since } } }) : Promise.resolve(0),
  ]);
  return byEmail >= MAX_FAILED_LOGINS || byIp >= 40;
}

export async function recordLoginAttempt(email: string, success: boolean) {
  await db.loginAttempt.create({ data: { email, success, ip: await clientIp() } });
  if (success) {
    // uğurlu girişdən sonra bu e-poçt üçün uğursuz cəhdlər sayılmır
    await db.loginAttempt.deleteMany({ where: { email, success: false } });
  }
}

export const LOCK_MESSAGE = `Çox sayda uğursuz cəhd edildi. ${LOCK_MINUTES} dəqiqə sonra yenidən yoxlayın.`;

// ── E-poçt kodları (qeydiyyat təsdiqi və şifrə bərpası) ──────────────

const codeHash = (email: string, purpose: string, code: string) => sha256(`${purpose}:${email}:${code}:${env.authSecret}`);

export async function sendEmailCode(emailRaw: string, purpose: "verify" | "reset"): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = normalizeEmail(emailRaw);
  const ip = await clientIp();
  const since = new Date(Date.now() - 15 * 60_000);
  const [byEmail, byIp] = await Promise.all([
    db.loginCode.count({ where: { email, createdAt: { gt: since } } }),
    ip ? db.loginCode.count({ where: { ip, createdAt: { gt: since } } }) : Promise.resolve(0),
  ]);
  if (byEmail >= 5 || byIp >= 30) return { ok: false, error: "Çox sayda kod istənildi. Bir neçə dəqiqə sonra yenidən yoxlayın." };
  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await db.loginCode.updateMany({ where: { email, purpose, consumedAt: null }, data: { consumedAt: new Date() } });
  await db.loginCode.create({ data: { email, purpose, codeHash: codeHash(email, purpose, code), expiresAt: new Date(Date.now() + CODE_TTL_MIN * 60_000), ip } });
  const title = purpose === "verify" ? "E-poçt təsdiq kodu" : "Şifrə bərpası kodu";
  const html = emailLayout({
    title,
    intro: purpose === "verify" ? "Kitabxana rezervasiya sistemində qeydiyyatı tamamlamaq üçün kodu daxil edin." : "Şifrənizi yeniləmək üçün aşağıdakı kodu daxil edin.",
    bodyHtml: `<div style="margin:20px 0;padding:18px;border-radius:12px;background:#F0F3BF;text-align:center;font-size:32px;letter-spacing:10px;font-weight:700;color:#16423C">${escapeHtml(code)}</div>`,
    footnote: `Kod ${CODE_TTL_MIN} dəqiqə ərzində etibarlıdır. Bu sorğunu siz göndərməmisinizsə, məktuba məhəl qoymayın.`,
  });
  await queueMail({ to: email, subject: `${title}: ${code}`, html, text: `${title}: ${code}` }, { await: true });
  return { ok: true };
}

export async function checkEmailCode(emailRaw: string, purpose: "verify" | "reset", codeRaw: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const email = normalizeEmail(emailRaw);
  const code = codeRaw.replace(/\D/g, "");
  if (code.length !== 6) return { ok: false, error: "Kod 6 rəqəmdən ibarət olmalıdır." };
  const row = await db.loginCode.findFirst({ where: { email, purpose, consumedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
  if (!row) return { ok: false, error: "Kodun vaxtı bitib. Yeni kod istəyin." };
  if (row.attempts >= MAX_CODE_ATTEMPTS) return { ok: false, error: "Cəhdlərin sayı bitib. Yeni kod istəyin." };
  const a = Buffer.from(row.codeHash, "hex");
  const b = Buffer.from(codeHash(email, purpose, code), "hex");
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    await db.loginCode.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    return { ok: false, error: "Kod yanlışdır." };
  }
  await db.loginCode.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
  return { ok: true };
}

/** Kod təsdiqindən sonra növbəti addıma ötürülən imzalı token (30 dəq) */
export function signEmailProof(email: string, purpose: string): string {
  const exp = Date.now() + 30 * 60_000;
  const mac = crypto.createHmac("sha256", env.authSecret).update(`${purpose}|${email}|${exp}`).digest("base64url");
  return `${exp}.${mac}`;
}

export function checkEmailProof(email: string, purpose: string, token: string | null | undefined): boolean {
  if (!token) return false;
  const [expStr, mac] = token.split(".");
  const exp = Number(expStr);
  if (!exp || exp < Date.now() || !mac) return false;
  const expected = crypto.createHmac("sha256", env.authSecret).update(`${purpose}|${email}|${exp}`).digest("base64url");
  return mac.length === expected.length && crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected));
}

/** Yönləndirmə üçün təhlükəsiz daxili yol */
export function safeNext(next: string | null | undefined, fallback = "/panel"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
