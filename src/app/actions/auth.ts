"use server";

import { redirect } from "next/navigation";
import {
  LOCK_MESSAGE, checkEmailCode, checkEmailProof, createSession, destroyOtherSessions, destroySession, emailVerificationEnabled,
  isStaff, loginLocked, recordLoginAttempt, requireUser, safeNext, sendEmailCode, signEmailProof,
} from "@/lib/auth";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { env, isAllowedEmail, normalizeEmail } from "@/lib/env";
import { hashPassword, passwordProblem, verifyPassword } from "@/lib/password";

export type LoginStep = "email" | "password" | "verify" | "register" | "forgot" | "reset";
export type LoginState = { step: LoginStep; email?: string; firstName?: string | null; error?: string; info?: string; proof?: string };

const str = (f: FormData, k: string) => String(f.get(k) ?? "");

export async function loginAction(prev: LoginState, form: FormData): Promise<LoginState> {
  const intent = str(form, "intent");
  const email = normalizeEmail(str(form, "email") || prev.email || "");
  const next = safeNext(str(form, "next"));
  const verification = emailVerificationEnabled();

  if (intent === "change") return { step: "email", email };

  if (!isAllowedEmail(email)) {
    return { step: "email", email, error: `Yalnız universitet e-poçtu ilə daxil olmaq mümkündür (@${env.allowedDomains.join(", @")}).` };
  }

  switch (intent) {
    case "email": {
      const user = await db.user.findUnique({ where: { email } });
      if (user?.passwordHash) return { step: "password", email, firstName: user.firstName };
      if (user && isStaff(user) && !verification) {
        return { step: "email", email, error: "Bu hesabın şifrəsi administrator tərəfindən verilir. Super admin ilə əlaqə saxlayın." };
      }
      if (verification) {
        const r = await sendEmailCode(email, "verify");
        if (!r.ok) return { step: "email", email, error: r.error };
        return { step: "verify", email, info: `Təsdiq kodu ${email} ünvanına göndərildi.` };
      }
      return { step: "register", email };
    }

    case "password": {
      if (await loginLocked(email)) return { step: "password", email, error: LOCK_MESSAGE };
      const user = await db.user.findUnique({ where: { email } });
      const ok = await verifyPassword(str(form, "password"), user?.passwordHash);
      await recordLoginAttempt(email, ok);
      if (!ok || !user) return { step: "password", email, firstName: user?.firstName, error: "E-poçt və ya şifrə yanlışdır." };
      await createSession(user.id);
      await audit(user.id, "auth.login", "User", user.id);
      // Adminlər standart olaraq idarəetmə panelinə yönləndirilir
      redirect(isStaff(user) && next === "/panel" && !user.mustChangePassword ? "/admin" : next);
    }

    case "verify": {
      const r = await checkEmailCode(email, "verify", str(form, "code"));
      if (!r.ok) return { step: "verify", email, error: r.error };
      return { step: "register", email, proof: signEmailProof(email, "verify") };
    }

    case "resend-verify": {
      const r = await sendEmailCode(email, "verify");
      return r.ok ? { step: "verify", email, info: "Yeni kod göndərildi." } : { step: "verify", email, error: r.error };
    }

    case "register": {
      const proofOk = checkEmailProof(email, "verify", str(form, "proof"));
      if (verification && !proofOk) return { step: "email", email, error: "Təsdiq vaxtı bitib. Yenidən başlayın." };
      const pw = str(form, "password");
      const problem = passwordProblem(pw);
      if (problem) return { ...prev, step: "register", email, error: problem };
      if (pw !== str(form, "password2")) return { ...prev, step: "register", email, error: "Şifrələr eyni deyil." };
      const existing = await db.user.findUnique({ where: { email } });
      if (existing?.passwordHash) return { step: "password", email, firstName: existing.firstName, error: "Bu e-poçt artıq qeydiyyatdadır — şifrənizi daxil edin." };
      if (existing && isStaff(existing) && !proofOk) return { step: "email", email, error: "Bu hesabın şifrəsi administrator tərəfindən verilir." };
      const passwordHash = await hashPassword(pw);
      // ADMIN_EMAILS yalnız e-poçt sahibliyi təsdiqlənibsə tətbiq olunur
      const promote = proofOk && env.adminEmails.includes(email);
      const user = existing
        ? await db.user.update({
            where: { id: existing.id },
            data: { passwordHash, passwordSetAt: new Date(), emailVerifiedAt: proofOk ? new Date() : existing.emailVerifiedAt, ...(promote ? { role: "SUPERADMIN" } : {}) },
          })
        : await db.user.create({
            data: { email, passwordHash, passwordSetAt: new Date(), emailVerifiedAt: proofOk ? new Date() : null, role: promote ? "SUPERADMIN" : "STUDENT" },
          });
      await audit(user.id, "user.registered", "User", user.id, { email, verified: proofOk });
      await createSession(user.id);
      redirect(next);
    }

    case "forgot": {
      if (!verification) {
        return {
          step: "forgot",
          email,
          info: "Şifrəni bərpa etmək üçün kitabxana administratoruna müraciət edin — o, sizə müvəqqəti şifrə verəcək. İlk girişdə yeni şifrə təyin edəcəksiniz.",
        };
      }
      const user = await db.user.findUnique({ where: { email } });
      if (user) {
        const r = await sendEmailCode(email, "reset");
        if (!r.ok) return { step: "forgot", email, error: r.error };
      }
      // Hesabın mövcudluğunu açıqlamamaq üçün eyni cavab
      return { step: "reset", email, info: `Hesab mövcuddursa, bərpa kodu ${email} ünvanına göndərildi.` };
    }

    case "reset": {
      if (!verification) return { step: "forgot", email };
      const r = await checkEmailCode(email, "reset", str(form, "code"));
      if (!r.ok) return { step: "reset", email, error: r.error };
      const pw = str(form, "password");
      const problem = passwordProblem(pw);
      if (problem) return { step: "reset", email, error: problem };
      const user = await db.user.findUnique({ where: { email } });
      if (!user) return { step: "email", email, error: "Hesab tapılmadı." };
      await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(pw), passwordSetAt: new Date(), mustChangePassword: false, emailVerifiedAt: user.emailVerifiedAt ?? new Date() } });
      await db.session.deleteMany({ where: { userId: user.id } });
      await audit(user.id, "auth.password_reset", "User", user.id);
      await createSession(user.id);
      redirect(next);
    }
  }
  return { step: "email", email };
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}

export type PasswordState = { error?: string; ok?: string };

/** Şifrəni dəyiş (profil və ya admin tərəfindən sıfırlanandan sonra məcburi) */
export async function changePasswordAction(_prev: PasswordState, form: FormData): Promise<PasswordState> {
  const user = await requireUser();
  const current = str(form, "current");
  const pw = str(form, "password");
  if (!user.mustChangePassword || current) {
    if (!(await verifyPassword(current, user.passwordHash))) return { error: "Hazırkı şifrə yanlışdır." };
  }
  const problem = passwordProblem(pw);
  if (problem) return { error: problem };
  if (pw !== str(form, "password2")) return { error: "Şifrələr eyni deyil." };
  if (await verifyPassword(pw, user.passwordHash)) return { error: "Yeni şifrə köhnə şifrədən fərqli olmalıdır." };
  await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(pw), passwordSetAt: new Date(), mustChangePassword: false } });
  await destroyOtherSessions(user.id);
  await audit(user.id, "auth.password_changed", "User", user.id);
  return { ok: "Şifrə yeniləndi. Digər cihazlardakı sessiyalar bağlandı." };
}
