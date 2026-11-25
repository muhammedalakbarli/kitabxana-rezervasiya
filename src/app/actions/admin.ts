"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { canAccessLibrary, requireStaff, requireSuperAdmin, setAdminScope, type StaffContext } from "@/lib/auth";
import { db } from "@/lib/db";
import { env, isAllowedEmail, normalizeEmail } from "@/lib/env";
import { go } from "@/lib/flash";
import { audit } from "@/lib/audit";
import { applyBlock, liftBlock } from "@/lib/blocks";
import { cancelEquipmentReservation, createEquipmentReservation, issueEquipment, returnEquipment } from "@/lib/equipment";
import { archiveLibrary, deleteEquipment, deleteRoom, setEquipmentMaintenance, setRoomMaintenance } from "@/lib/management";
import { hashPassword, temporaryPassword } from "@/lib/password";
import { cancelReservation, decideExtension, staffCheckIn } from "@/lib/reservations";
import { rulesSchema } from "@/lib/rules-config";
import { saveRules } from "@/lib/settings";
import { runSweep } from "@/lib/sweep";
import { qrToken, slugify } from "@/lib/tokens";
import { dayKey, isValidDayKey, parseHHMM, zoned } from "@/lib/time";

export type FormState = { error?: string; ok?: string; secret?: string };

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const back = (f: FormData, fallback: string) => {
  const b = str(f, "back");
  return b.startsWith("/admin") ? b : fallback;
};
const denied = (f: FormData, fallback: string): never => go(back(f, fallback), { err: "Bu obyekt sizin kitabxanaya aid deyil." });

async function guardReservation(ctx: StaffContext, id: string, form: FormData, fallback: string) {
  const r = await db.reservation.findUnique({ where: { id }, select: { room: { select: { libraryId: true } } } });
  if (!r || !canAccessLibrary(ctx, r.room.libraryId)) denied(form, fallback);
}
async function guardEquipmentReservation(ctx: StaffContext, id: string, form: FormData, fallback: string) {
  const r = await db.equipmentReservation.findUnique({ where: { id }, select: { equipment: { select: { libraryId: true } } } });
  if (!r || !canAccessLibrary(ctx, r.equipment.libraryId)) denied(form, fallback);
}

// ── Əhatə dairəsi (super admin kitabxana seçir) ──────────────────────

export async function setScopeAction(form: FormData) {
  await requireSuperAdmin();
  const id = str(form, "libraryId");
  await setAdminScope(id && id !== "all" ? id : null);
  redirect(back(form, "/admin"));
}

// ── Rezervasiyalar və müraciətlər ────────────────────────────────────

export async function adminCancelReservationAction(form: FormData) {
  const ctx = await requireStaff();
  const id = str(form, "id");
  await guardReservation(ctx, id, form, "/admin/rezervasiyalar");
  const reason = str(form, "reason") || "Kitabxana administratoru tərəfindən ləğv edildi";
  const res = await cancelReservation(ctx.user, id, { byStaff: true, reason });
  go(back(form, "/admin/rezervasiyalar"), res.ok ? { ok: "Rezervasiya ləğv edildi, iştirakçılara bildiriş göndərildi." } : { err: res.error });
}

export async function staffCheckInAction(form: FormData) {
  const ctx = await requireStaff();
  const p = await db.reservationParticipant.findUnique({ where: { id: str(form, "participantId") }, select: { reservationId: true } });
  if (!p) go(back(form, "/admin/rezervasiyalar"), { err: "İştirakçı tapılmadı." });
  await guardReservation(ctx, p.reservationId, form, "/admin/rezervasiyalar");
  const res = await staffCheckIn(ctx.user, str(form, "participantId"));
  go(back(form, "/admin/rezervasiyalar"), res.ok ? { ok: "İştirakçı əl ilə təsdiqləndi." } : { err: res.error });
}

export async function decideExtensionAction(form: FormData) {
  const ctx = await requireStaff();
  const q = await db.extensionRequest.findUnique({ where: { id: str(form, "requestId") }, select: { reservationId: true } });
  if (!q) go("/admin/muracietler", { err: "Müraciət tapılmadı." });
  await guardReservation(ctx, q.reservationId, form, "/admin/muracietler");
  const approve = form.get("decision") === "approve";
  const res = await decideExtension(ctx.user, str(form, "requestId"), approve, str(form, "note") || undefined);
  go("/admin/muracietler", res.ok ? { ok: approve ? "Müraciət təsdiqləndi, rezervasiya uzadıldı." : "Müraciət rədd edildi." } : { err: res.error });
}

// ── Avadanlıq masası ─────────────────────────────────────────────────

export async function issueEquipmentAction(form: FormData) {
  const ctx = await requireStaff();
  await guardEquipmentReservation(ctx, str(form, "id"), form, "/admin/avadanliq");
  const res = await issueEquipment(ctx.user, str(form, "id"));
  go(back(form, "/admin/avadanliq"), res.ok ? { ok: "Avadanlıq təhvil verildi." } : { err: res.error });
}

export async function returnEquipmentAction(form: FormData) {
  const ctx = await requireStaff();
  await guardEquipmentReservation(ctx, str(form, "id"), form, "/admin/avadanliq");
  const res = await returnEquipment(ctx.user, str(form, "id"), str(form, "note"), form.get("damaged") === "1");
  go(back(form, "/admin/avadanliq"), res.ok ? { ok: "Avadanlıq qəbul edildi." } : { err: res.error });
}

export async function adminCancelEquipmentAction(form: FormData) {
  const ctx = await requireStaff();
  await guardEquipmentReservation(ctx, str(form, "id"), form, "/admin/avadanliq");
  const res = await cancelEquipmentReservation(ctx.user, str(form, "id"), true);
  go(back(form, "/admin/avadanliq"), res.ok ? { ok: "Rezervasiya ləğv edildi." } : { err: res.error });
}

export async function deskReserveAction(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireStaff();
  const eq = await db.equipment.findUnique({ where: { id: str(form, "equipmentId") }, select: { libraryId: true } });
  if (!eq || !canAccessLibrary(ctx, eq.libraryId)) return { error: "Avadanlıq sizin kitabxanaya aid deyil." };
  const day = dayKey(new Date());
  const startMin = parseHHMM(str(form, "start"));
  const minutes = Number(form.get("minutes"));
  if (startMin === null || !minutes) return { error: "Başlanğıc vaxtı və müddəti seçin." };
  const start = zoned(day, startMin);
  const res = await createEquipmentReservation(ctx.user, {
    equipmentId: str(form, "equipmentId"),
    start,
    end: new Date(start.getTime() + minutes * 60_000),
    rulesAccepted: true,
    forEmail: str(form, "email"),
  });
  if (!res.ok) return { error: res.error };
  if (form.get("issueNow") === "1") {
    const iss = await issueEquipment(ctx.user, res.id);
    if (!iss.ok) return { ok: `Rezerv yaradıldı, amma təhvil qeyd olunmadı: ${iss.error}` };
  }
  revalidatePath("/admin/avadanliq");
  return { ok: form.get("issueNow") === "1" ? "Rezerv yaradıldı və avadanlıq təhvil verildi." : "Rezerv yaradıldı." };
}

// ── İstifadəçilər ────────────────────────────────────────────────────

export async function blockUserAction(form: FormData) {
  const ctx = await requireStaff();
  const id = str(form, "userId");
  const note = str(form, "note");
  if (note.length < 3) go(`/admin/istifadeciler/${id}`, { err: "Bloklama səbəbini yazın." });
  await applyBlock(id, "MANUAL", note, ctx.user.id);
  go(`/admin/istifadeciler/${id}`, { ok: "İstifadəçi bloklandı." });
}

export async function unblockUserAction(form: FormData) {
  const ctx = await requireStaff();
  const id = str(form, "userId");
  await liftBlock(id, ctx.user.id, str(form, "note") || null);
  go(back(form, `/admin/istifadeciler/${id}`), { ok: "Blok açıldı, xəbərdarlıq sayı sıfırlandı." });
}

/** Müvəqqəti şifrə — yalnız bir dəfə göstərilir; istifadəçi ilk girişdə dəyişməlidir */
export async function resetPasswordAction(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireStaff();
  const target = await db.user.findUnique({ where: { id: str(form, "userId") } });
  if (!target) return { error: "İstifadəçi tapılmadı." };
  if (target.role !== "STUDENT" && !ctx.superAdmin) return { error: "Admin hesablarının şifrəsini yalnız super admin sıfırlaya bilər." };
  if (target.id === ctx.user.id) return { error: "Öz şifrənizi profil səhifəsindən dəyişin." };
  const temp = temporaryPassword();
  await db.user.update({ where: { id: target.id }, data: { passwordHash: await hashPassword(temp), passwordSetAt: new Date(), mustChangePassword: true } });
  await db.session.deleteMany({ where: { userId: target.id } });
  await audit(ctx.user.id, "admin.password_reset", "User", target.id);
  return { ok: "Müvəqqəti şifrə yaradıldı. Onu istifadəçiyə şəxsən təqdim edin — bir daha göstərilməyəcək.", secret: temp };
}

export async function setRoleAction(form: FormData) {
  const ctx = await requireSuperAdmin();
  const id = str(form, "userId");
  const role = z.enum(["STUDENT", "SUPERVISOR", "SUPERADMIN"]).safeParse(str(form, "role"));
  if (!role.success) go(`/admin/istifadeciler/${id}`, { err: "Rol yanlışdır." });
  if (id === ctx.user.id && role.data !== "SUPERADMIN") go(`/admin/istifadeciler/${id}`, { err: "Öz super admin rolunuzu ləğv edə bilməzsiniz." });
  const libraryId = str(form, "libraryId") || null;
  if (role.data === "SUPERVISOR" && !libraryId) go(`/admin/istifadeciler/${id}`, { err: "Supervayzer üçün kitabxana seçin." });
  await db.user.update({ where: { id }, data: { role: role.data, libraryId: role.data === "SUPERVISOR" ? libraryId : null } });
  await audit(ctx.user.id, "user.role", "User", id, { role: role.data, libraryId });
  go(`/admin/istifadeciler/${id}`, { ok: "Rol yeniləndi." });
}

// ── Supervayzerlər (adminlər) ────────────────────────────────────────

export async function saveSupervisorAction(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireSuperAdmin();
  const email = normalizeEmail(str(form, "email"));
  const firstName = str(form, "firstName");
  const lastName = str(form, "lastName");
  const libraryId = str(form, "libraryId");
  if (!isAllowedEmail(email)) return { error: `Universitet e-poçtu daxil edin (@${env.allowedDomains[0]}).` };
  if (firstName.length < 2 || lastName.length < 2) return { error: "Ad və soyadı daxil edin." };
  const lib = await db.library.findFirst({ where: { id: libraryId, archivedAt: null } });
  if (!lib) return { error: "Kitabxananı seçin." };
  const existing = await db.user.findUnique({ where: { email } });
  if (existing?.role === "SUPERADMIN") return { error: "Bu istifadəçi artıq super admindir." };
  const temp = !existing?.passwordHash || form.get("newPassword") === "1" ? temporaryPassword() : null;
  const data = {
    role: "SUPERVISOR" as const,
    libraryId: lib.id,
    firstName,
    lastName,
    name: `${firstName} ${lastName}`,
    userType: existing?.userType ?? ("EMPLOYEE" as const),
    department: existing?.department ?? `${lib.shortName} kitabxanası`,
    profileCompletedAt: existing?.profileCompletedAt ?? new Date(),
    ...(temp ? { passwordHash: await hashPassword(temp), passwordSetAt: new Date(), mustChangePassword: true } : {}),
  };
  const user = existing ? await db.user.update({ where: { id: existing.id }, data }) : await db.user.create({ data: { email, ...data } });
  await audit(ctx.user.id, "admin.supervisor", "User", user.id, { libraryId: lib.id });
  revalidatePath("/admin/idare/adminler");
  return temp
    ? { ok: `${user.name} — ${lib.shortName} kitabxanasına supervayzer təyin edildi. Müvəqqəti şifrəni təqdim edin (bir dəfə göstərilir):`, secret: temp }
    : { ok: `${user.name} — ${lib.shortName} kitabxanasına supervayzer təyin edildi. Mövcud şifrəsi ilə daxil ola bilər.` };
}

export async function removeSupervisorAction(form: FormData) {
  const ctx = await requireSuperAdmin();
  const id = str(form, "userId");
  await db.user.update({ where: { id }, data: { role: "STUDENT", libraryId: null } });
  await db.session.deleteMany({ where: { userId: id } });
  await audit(ctx.user.id, "user.role", "User", id, { role: "STUDENT" });
  go("/admin/idare/adminler", { ok: "Admin hüquqları götürüldü." });
}

// ── Qaydalar və bayramlar ────────────────────────────────────────────

export async function saveRulesAction(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireSuperAdmin();
  const raw: Record<string, number> = {};
  for (const key of Object.keys(rulesSchema.shape)) raw[key] = Number(form.get(key));
  const parsed = rulesSchema.safeParse(raw);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { error: `${String(i.path[0])}: ${i.message}` };
  }
  await saveRules(parsed.data, ctx.user.id);
  await audit(ctx.user.id, "settings.rules", "Setting", "rules", parsed.data);
  revalidatePath("/", "layout");
  return { ok: "Qaydalar yadda saxlanıldı və dərhal qüvvəyə mindi." };
}

export async function addClosedDayAction(form: FormData) {
  const ctx = await requireSuperAdmin();
  const date = str(form, "date");
  if (!isValidDayKey(date)) go("/admin/idare/qaydalar", { err: "Tarix yanlışdır." });
  const libraryId = str(form, "libraryId") || null;
  await db.closedDay.create({ data: { date, reason: str(form, "reason") || "Qeyri-iş günü", libraryId } });
  await audit(ctx.user.id, "closedday.add", "ClosedDay", null, { date, libraryId });
  go("/admin/idare/qaydalar", { ok: "Qeyri-iş günü əlavə edildi." });
}

export async function removeClosedDayAction(form: FormData) {
  const ctx = await requireSuperAdmin();
  await db.closedDay.delete({ where: { id: str(form, "id") } });
  await audit(ctx.user.id, "closedday.remove", "ClosedDay", str(form, "id"));
  go("/admin/idare/qaydalar", { ok: "Silindi." });
}

export async function runSweepAction() {
  await requireStaff();
  const r = await runSweep(true);
  go("/admin", { ok: `Vəziyyət yeniləndi: ${r?.finalized ?? 0} rezerv yekunlaşdı, ${r?.equipment ?? 0} avadanlıq yoxlandı.` });
}

// ── Fakültələr ───────────────────────────────────────────────────────

export async function saveFacultyAction(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireSuperAdmin();
  const id = str(form, "id");
  const name = str(form, "name");
  if (name.length < 3) return { error: "Fakültənin adını daxil edin." };
  const dup = await db.faculty.findUnique({ where: { name } });
  if (dup && dup.id !== id) return { error: "Bu adda fakültə artıq var." };
  const data = { name, shortName: str(form, "shortName") || null, sortOrder: Number(form.get("sortOrder") || 0), isActive: form.get("isActive") !== "0" };
  const f = id ? await db.faculty.update({ where: { id }, data }) : await db.faculty.create({ data });
  if (id) await db.user.updateMany({ where: { facultyId: id }, data: { faculty: name } });
  await audit(ctx.user.id, id ? "faculty.updated" : "faculty.created", "Faculty", f.id, data);
  revalidatePath("/admin/idare/kitabxanalar");
  return { ok: id ? "Fakültə yeniləndi." : "Fakültə əlavə edildi." };
}

export async function deleteFacultyAction(form: FormData) {
  const ctx = await requireSuperAdmin();
  const id = str(form, "id");
  const [users, libs] = await Promise.all([db.user.count({ where: { facultyId: id } }), db.library.count({ where: { facultyId: id } })]);
  if (users || libs) {
    await db.faculty.update({ where: { id }, data: { isActive: false } });
    await audit(ctx.user.id, "faculty.updated", "Faculty", id, { isActive: false });
    go("/admin/idare/kitabxanalar", { ok: "Fakültəyə bağlı istifadəçi/kitabxana olduğu üçün silinmədi, deaktiv edildi (siyahıda görünmür)." });
  }
  await db.faculty.delete({ where: { id } });
  await audit(ctx.user.id, "faculty.deleted", "Faculty", id);
  go("/admin/idare/kitabxanalar", { ok: "Fakültə silindi." });
}

// ── Kitabxanalar ─────────────────────────────────────────────────────

const libSchema = z.object({
  name: z.string().trim().min(3, "Kitabxananın adını daxil edin").max(120),
  shortName: z.string().trim().min(2, "Qısa adı daxil edin").max(60),
  building: z.string().trim().min(2, "Binanı daxil edin").max(160),
  address: z.string().trim().max(200).optional(),
  description: z.string().trim().max(1000).optional(),
  facultyId: z.string().optional(),
  sortOrder: z.coerce.number().int().min(0).max(999),
});

export async function saveLibraryAction(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireSuperAdmin();
  const id = str(form, "id");
  const parsed = libSchema.safeParse({
    name: str(form, "name"), shortName: str(form, "shortName"), building: str(form, "building"), address: str(form, "address"),
    description: str(form, "description"), facultyId: str(form, "facultyId"), sortOrder: str(form, "sortOrder") || "0",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const data = {
    name: d.name, shortName: d.shortName, building: d.building, address: d.address || null, description: d.description || null,
    facultyId: d.facultyId || null, sortOrder: d.sortOrder, isActive: form.get("isActive") !== "0",
  };
  if (id) {
    await db.library.update({ where: { id }, data });
    await audit(ctx.user.id, "library.updated", "Library", id, data);
    revalidatePath("/admin", "layout");
    return { ok: "Kitabxana yeniləndi." };
  }
  let slug = slugify(d.shortName || d.name) || `kitabxana-${Date.now()}`;
  if (await db.library.findUnique({ where: { slug } })) slug = `${slug}-${crypto.randomBytes(2).toString("hex")}`;
  const lib = await db.library.create({ data: { ...data, slug } });
  await audit(ctx.user.id, "library.created", "Library", lib.id, data);
  await setAdminScope(lib.id);
  go("/admin/idare/otaqlar", { ok: `${lib.name} yaradıldı. İndi oxu otaqlarını və avadanlığı əlavə edin.` });
}

export async function saveLibraryHoursAction(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireSuperAdmin();
  const id = str(form, "id");
  const open = parseHHMM(str(form, "open"));
  const close = parseHHMM(str(form, "close"));
  const bStart = str(form, "bookingStart") ? parseHHMM(str(form, "bookingStart")) : null;
  const bEnd = str(form, "bookingEnd") ? parseHHMM(str(form, "bookingEnd")) : null;
  const workDays = [...new Set(form.getAll("workDays").map(Number).filter((n) => n >= 1 && n <= 7))].sort();
  if (open === null || close === null || close <= open) return { error: "İş saatları yanlışdır." };
  if (!workDays.length) return { error: "Ən azı bir iş günü seçin." };
  const s = bStart ?? open;
  const e = bEnd ?? close;
  if (s < open || e > close || e <= s) return { error: "İlk və son rezervasiya vaxtı iş saatları daxilində olmalıdır." };
  const data = { openMinute: open, closeMinute: close, bookingStartMinute: bStart, bookingEndMinute: bEnd, workDays: workDays.join(",") };
  await db.library.update({ where: { id }, data });
  await audit(ctx.user.id, "library.hours", "Library", id, data);
  revalidatePath("/admin", "layout");
  return { ok: "İş saatları və rezervasiya vaxtları yeniləndi. Mövcud rezervasiyalar dəyişmir." };
}

export async function archiveLibraryAction(form: FormData) {
  const ctx = await requireSuperAdmin();
  const r = await archiveLibrary(ctx.user, str(form, "id"));
  await setAdminScope(null);
  go("/admin/idare/kitabxanalar", { ok: `Kitabxana silindi (arxivə köçürüldü). ${r.cancelled} gələcək rezerv ləğv edildi. Tarixçə hesabatlarda qalır.` });
}

// ── Otaqlar ──────────────────────────────────────────────────────────

const roomSchema = z.object({
  name: z.string().trim().min(1, "Otağın adını daxil edin").max(60),
  code: z.string().trim().max(20).optional(),
  capacity: z.coerce.number().int().min(1, "Tutum ən azı 1").max(30),
  description: z.string().trim().max(1000).optional(),
  features: z.string().trim().max(1000).optional(),
  sortOrder: z.coerce.number().int().min(0).max(999),
});

export async function saveRoomAction(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireSuperAdmin();
  const id = str(form, "id");
  const libraryId = str(form, "libraryId");
  const parsed = roomSchema.safeParse({
    name: str(form, "name"), code: str(form, "code"), capacity: str(form, "capacity") || "8", description: str(form, "description"),
    features: str(form, "features"), sortOrder: str(form, "sortOrder") || "0",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = { ...parsed.data, code: parsed.data.code || null, description: parsed.data.description || null, features: parsed.data.features ?? "" };
  if (id) {
    await db.room.update({ where: { id }, data });
    await audit(ctx.user.id, "room.updated", "Room", id, data);
  } else {
    const lib = await db.library.findFirst({ where: { id: libraryId, archivedAt: null } });
    if (!lib) return { error: "Kitabxana seçin." };
    let slug = slugify(data.code || data.name) || `otaq-${Date.now()}`;
    if (await db.room.findUnique({ where: { libraryId_slug: { libraryId, slug } } })) slug = `${slug}-${crypto.randomBytes(2).toString("hex")}`;
    const room = await db.room.create({ data: { ...data, libraryId, slug, qrToken: qrToken() } });
    await audit(ctx.user.id, "room.created", "Room", room.id, data);
  }
  revalidatePath("/admin/idare/otaqlar");
  return { ok: id ? "Otaq yeniləndi." : "Otaq əlavə edildi." };
}

export async function roomMaintenanceAction(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireSuperAdmin();
  const on = form.get("on") === "1";
  const r = await setRoomMaintenance(ctx.user, str(form, "id"), on, str(form, "note") || null);
  revalidatePath("/admin/idare/otaqlar");
  return { ok: on ? `Otaq təmirə bağlandı.${r.cancelled ? ` ${r.cancelled} gələcək rezerv ləğv edildi və istifadəçilərə bildiriş göndərildi.` : ""}` : "Otaq yenidən istifadəyə açıldı." };
}

export async function deleteRoomAction(form: FormData) {
  const ctx = await requireSuperAdmin();
  const r = await deleteRoom(ctx.user, str(form, "id"));
  go("/admin/idare/otaqlar", { ok: r.archived ? `Otaq silindi (tarixçəsi hesabatlar üçün saxlanılır).${r.cancelled ? ` ${r.cancelled} rezerv ləğv edildi.` : ""}` : "Otaq silindi." });
}

// ── Avadanlıq ────────────────────────────────────────────────────────

const eqSchema = z.object({
  type: z.enum(["LAPTOP", "ADAPTER"]),
  assetTag: z.string().trim().min(2, "Etiket nömrəsini daxil edin").max(20).regex(/^[A-Za-z0-9-]+$/, "Etiket yalnız hərf, rəqəm və '-' ola bilər"),
  name: z.string().trim().min(2, "Adı daxil edin").max(80),
  description: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(500).optional(),
  libraryId: z.string().min(1, "Kitabxana seçin"),
});

export async function saveEquipmentAction(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireSuperAdmin();
  const id = str(form, "id");
  const parsed = eqSchema.safeParse({
    type: str(form, "type"), assetTag: str(form, "assetTag").toUpperCase(), name: str(form, "name"),
    description: str(form, "description"), notes: str(form, "notes"), libraryId: str(form, "libraryId"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const dup = await db.equipment.findUnique({ where: { assetTag: parsed.data.assetTag } });
  if (dup && dup.id !== id) return { error: "Bu etiket nömrəsi artıq istifadə olunur." };
  const data = { ...parsed.data, description: parsed.data.description || null, notes: parsed.data.notes || null };
  if (id) {
    await db.equipment.update({ where: { id }, data });
    await audit(ctx.user.id, "equipment.updated", "Equipment", id, data);
  } else {
    const e = await db.equipment.create({
      data: { ...data, qrToken: qrToken(), photoUrl: data.type === "LAPTOP" ? "/media/equipment/noutbuk-a.jpg" : "/media/equipment/adapter.svg" },
    });
    await audit(ctx.user.id, "equipment.created", "Equipment", e.id, data);
  }
  revalidatePath("/admin/idare/avadanliq");
  return { ok: id ? "Avadanlıq yeniləndi." : "Avadanlıq əlavə edildi." };
}

export async function equipmentMaintenanceAction(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireSuperAdmin();
  const on = form.get("on") === "1";
  const r = await setEquipmentMaintenance(ctx.user, str(form, "id"), on, str(form, "note") || null);
  revalidatePath("/admin/idare/avadanliq");
  return { ok: on ? `Avadanlıq təmirə göndərildi.${r.cancelled ? ` ${r.cancelled} rezerv ləğv edildi.` : ""}` : "Avadanlıq yenidən istifadəyə açıldı." };
}

export async function deleteEquipmentAction(form: FormData) {
  const ctx = await requireSuperAdmin();
  try {
    const r = await deleteEquipment(ctx.user, str(form, "id"));
    go("/admin/idare/avadanliq", { ok: r.archived ? "Avadanlıq silindi (tarixçəsi hesabatlar üçün saxlanılır)." : "Avadanlıq silindi." });
  } catch (e) {
    if ((e as { digest?: string }).digest?.startsWith("NEXT_REDIRECT")) throw e;
    go("/admin/idare/avadanliq", { err: (e as Error).message });
  }
}

export async function rotateQrAction(form: FormData) {
  const ctx = await requireSuperAdmin();
  const kind = str(form, "kind");
  const id = str(form, "id");
  if (kind === "room") await db.room.update({ where: { id }, data: { qrToken: qrToken() } });
  else await db.equipment.update({ where: { id }, data: { qrToken: qrToken() } });
  await audit(ctx.user.id, "qr.rotated", kind === "room" ? "Room" : "Equipment", id);
  go(back(form, "/admin/qr"), { ok: "Yeni QR kod yaradıldı. Köhnə kod artıq işləmir — yenisini çap edib yapışdırın." });
}

// ── Fotolar ──────────────────────────────────────────────────────────

const ALLOWED = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);

async function storeImage(file: File, folder: string): Promise<string> {
  const ext = ALLOWED.get(file.type);
  if (!ext) throw new Error("Yalnız JPG, PNG və ya WEBP şəkil yükləmək olar.");
  if (file.size > 4 * 1024 * 1024) throw new Error("Şəklin ölçüsü 4 MB-dan çox olmamalıdır.");
  const buf = Buffer.from(await file.arrayBuffer());
  const isJpg = buf[0] === 0xff && buf[1] === 0xd8;
  const isPng = buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = buf.subarray(0, 4).toString() === "RIFF" && buf.subarray(8, 12).toString() === "WEBP";
  if (!isJpg && !isPng && !isWebp) throw new Error("Fayl şəkil deyil.");
  const name = `${crypto.randomBytes(8).toString("hex")}.${ext}`;
  const dir = path.resolve(env.storageDir, folder);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, name), buf);
  return `/files/${folder}/${name}`;
}

export async function uploadRoomPhotoAction(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireSuperAdmin();
  const roomId = str(form, "roomId");
  const room = await db.room.findUnique({ where: { id: roomId } });
  const file = form.get("photo");
  if (!room) return { error: "Otaq tapılmadı." };
  if (!(file instanceof File) || !file.size) return { error: "Şəkil seçin." };
  try {
    const url = await storeImage(file, `rooms/${roomId}`);
    const count = await db.roomPhoto.count({ where: { roomId } });
    await db.roomPhoto.create({ data: { roomId, url, alt: room.name, sortOrder: count } });
    await audit(ctx.user.id, "room.photo.added", "Room", roomId, { url });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/admin/idare/otaqlar");
  return { ok: "Şəkil əlavə edildi." };
}

export async function deleteRoomPhotoAction(form: FormData) {
  const ctx = await requireSuperAdmin();
  const photo = await db.roomPhoto.findUniqueOrThrow({ where: { id: str(form, "photoId") } });
  await db.roomPhoto.delete({ where: { id: photo.id } });
  if (photo.url.startsWith("/files/")) {
    const p = path.resolve(env.storageDir, photo.url.replace(/^\/files\//, ""));
    if (p.startsWith(path.resolve(env.storageDir))) await fs.rm(p, { force: true });
  }
  await audit(ctx.user.id, "room.photo.deleted", "Room", photo.roomId, { url: photo.url });
  go("/admin/idare/otaqlar", { ok: "Şəkil silindi." });
}

export async function uploadEquipmentPhotoAction(_prev: FormState, form: FormData): Promise<FormState> {
  const ctx = await requireSuperAdmin();
  const id = str(form, "equipmentId");
  const file = form.get("photo");
  if (!(file instanceof File) || !file.size) return { error: "Şəkil seçin." };
  try {
    const url = await storeImage(file, `equipment/${id}`);
    await db.equipment.update({ where: { id }, data: { photoUrl: url } });
    await audit(ctx.user.id, "equipment.photo", "Equipment", id, { url });
  } catch (e) {
    return { error: (e as Error).message };
  }
  revalidatePath("/admin/idare/avadanliq");
  return { ok: "Şəkil yeniləndi." };
}
