"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { requireAdmin, requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { go } from "@/lib/flash";
import { audit } from "@/lib/audit";
import { applyBlock, liftBlock } from "@/lib/blocks";
import { cancelEquipmentReservation, createEquipmentReservation, issueEquipment, returnEquipment } from "@/lib/equipment";
import { cancelReservation, decideExtension, staffCheckIn } from "@/lib/reservations";
import { rulesSchema } from "@/lib/rules-config";
import { saveRules } from "@/lib/settings";
import { runSweep } from "@/lib/sweep";
import { qrToken, slugify } from "@/lib/tokens";
import { dayKey, isValidDayKey, parseHHMM, zoned } from "@/lib/time";
import type { FormState } from "./reservations";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const back = (f: FormData, fallback: string) => {
  const b = str(f, "back");
  return b.startsWith("/admin") ? b : fallback;
};

// ── Rezervasiyalar ───────────────────────────────────────────────────

export async function adminCancelReservationAction(form: FormData) {
  const staff = await requireStaff();
  const reason = str(form, "reason") || "Kitabxana əməkdaşı tərəfindən ləğv edildi";
  const res = await cancelReservation(staff, str(form, "id"), { byStaff: true, reason });
  go(back(form, "/admin/rezervasiyalar"), res.ok ? { ok: "Rezervasiya ləğv edildi, iştirakçılara bildiriş göndərildi." } : { err: res.error });
}

export async function staffCheckInAction(form: FormData) {
  const staff = await requireStaff();
  const res = await staffCheckIn(staff, str(form, "participantId"));
  go(back(form, "/admin/rezervasiyalar"), res.ok ? { ok: "İştirakçı əl ilə təsdiqləndi." } : { err: res.error });
}

export async function decideExtensionAction(form: FormData) {
  const staff = await requireStaff();
  const approve = form.get("decision") === "approve";
  const res = await decideExtension(staff, str(form, "requestId"), approve, str(form, "note") || undefined);
  go("/admin/muracietler", res.ok ? { ok: approve ? "Müraciət təsdiqləndi, rezervasiya uzadıldı." : "Müraciət rədd edildi." } : { err: res.error });
}

// ── Avadanlıq masası ─────────────────────────────────────────────────

export async function issueEquipmentAction(form: FormData) {
  const staff = await requireStaff();
  const res = await issueEquipment(staff, str(form, "id"));
  go(back(form, "/admin/avadanliq"), res.ok ? { ok: "Avadanlıq təhvil verildi." } : { err: res.error });
}

export async function returnEquipmentAction(form: FormData) {
  const staff = await requireStaff();
  const res = await returnEquipment(staff, str(form, "id"), str(form, "note"), form.get("damaged") === "1");
  go(back(form, "/admin/avadanliq"), res.ok ? { ok: "Avadanlıq qəbul edildi." } : { err: res.error });
}

export async function adminCancelEquipmentAction(form: FormData) {
  const staff = await requireStaff();
  const res = await cancelEquipmentReservation(staff, str(form, "id"), true);
  go(back(form, "/admin/avadanliq"), res.ok ? { ok: "Rezervasiya ləğv edildi." } : { err: res.error });
}

export async function deskReserveAction(_prev: FormState, form: FormData): Promise<FormState> {
  const staff = await requireStaff();
  const day = dayKey(new Date());
  const startMin = parseHHMM(str(form, "start"));
  const minutes = Number(form.get("minutes"));
  if (startMin === null || !minutes) return { error: "Başlanğıc vaxtı və müddəti seçin." };
  const start = zoned(day, startMin);
  const res = await createEquipmentReservation(staff, {
    equipmentId: str(form, "equipmentId"),
    start,
    end: new Date(start.getTime() + minutes * 60_000),
    rulesAccepted: true,
    forEmail: str(form, "email"),
  });
  if (!res.ok) return { error: res.error };
  if (form.get("issueNow") === "1") {
    const iss = await issueEquipment(staff, res.id);
    if (!iss.ok) return { ok: `Rezerv yaradıldı, amma təhvil qeyd olunmadı: ${iss.error}` };
  }
  revalidatePath("/admin/avadanliq");
  return { ok: form.get("issueNow") === "1" ? "Rezerv yaradıldı və avadanlıq təhvil verildi." : "Rezerv yaradıldı." };
}

// ── İstifadəçilər ────────────────────────────────────────────────────

export async function blockUserAction(form: FormData) {
  const staff = await requireStaff();
  const id = str(form, "userId");
  const note = str(form, "note");
  if (note.length < 3) go(`/admin/istifadeciler/${id}`, { err: "Bloklama səbəbini yazın." });
  await applyBlock(id, "MANUAL", note, staff.id);
  go(`/admin/istifadeciler/${id}`, { ok: "İstifadəçi bloklandı." });
}

export async function unblockUserAction(form: FormData) {
  const staff = await requireStaff();
  const id = str(form, "userId");
  await liftBlock(id, staff.id, str(form, "note") || null);
  go(back(form, `/admin/istifadeciler/${id}`), { ok: "Blok açıldı, xəbərdarlıq sayı sıfırlandı." });
}

export async function setRoleAction(form: FormData) {
  const admin = await requireAdmin();
  const id = str(form, "userId");
  const role = z.enum(["STUDENT", "STAFF", "ADMIN"]).safeParse(str(form, "role"));
  if (!role.success) go(`/admin/istifadeciler/${id}`, { err: "Rol yanlışdır." });
  if (id === admin.id && role.data !== "ADMIN") go(`/admin/istifadeciler/${id}`, { err: "Öz administrator rolunuzu ləğv edə bilməzsiniz." });
  await db.user.update({ where: { id }, data: { role: role.data } });
  await audit(admin.id, "user.role", "User", id, { role: role.data });
  go(`/admin/istifadeciler/${id}`, { ok: "Rol yeniləndi." });
}

// ── Parametrlər ──────────────────────────────────────────────────────

export async function saveRulesAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const raw: Record<string, number> = {};
  for (const key of Object.keys(rulesSchema.shape)) raw[key] = Number(form.get(key));
  const parsed = rulesSchema.safeParse(raw);
  if (!parsed.success) {
    const i = parsed.error.issues[0];
    return { error: `${String(i.path[0])}: ${i.message}` };
  }
  await saveRules(parsed.data, admin.id);
  await audit(admin.id, "settings.rules", "Setting", "rules", parsed.data);
  revalidatePath("/", "layout");
  return { ok: "Qaydalar yadda saxlanıldı və dərhal qüvvəyə mindi." };
}

export async function addClosedDayAction(form: FormData) {
  const admin = await requireAdmin();
  const date = str(form, "date");
  const reason = str(form, "reason") || "Qeyri-iş günü";
  if (!isValidDayKey(date)) go("/admin/parametrler", { err: "Tarix yanlışdır." });
  const libraryId = str(form, "libraryId") || null;
  await db.closedDay.create({ data: { date, reason, libraryId } });
  await audit(admin.id, "closedday.add", "ClosedDay", null, { date, libraryId });
  go("/admin/parametrler", { ok: "Qeyri-iş günü əlavə edildi." });
}

export async function removeClosedDayAction(form: FormData) {
  const admin = await requireAdmin();
  await db.closedDay.delete({ where: { id: str(form, "id") } });
  await audit(admin.id, "closedday.remove", "ClosedDay", str(form, "id"));
  go("/admin/parametrler", { ok: "Silindi." });
}

export async function runSweepAction() {
  await requireStaff();
  const r = await runSweep(true);
  go("/admin", { ok: `Fon tapşırıqları işlədi: ${r?.finalized ?? 0} rezerv yekunlaşdı, ${r?.equipment ?? 0} avadanlıq yoxlandı.` });
}

// ── Kitabxanalar, otaqlar, avadanlıq ─────────────────────────────────

const libSchema = z.object({
  name: z.string().trim().min(3).max(120),
  shortName: z.string().trim().min(2).max(60),
  building: z.string().trim().min(2).max(160),
  address: z.string().trim().max(200).optional(),
  description: z.string().trim().max(1000).optional(),
  open: z.string(),
  close: z.string(),
  workDays: z.array(z.coerce.number().int().min(1).max(7)).min(1, "Ən azı bir iş günü seçin"),
  isActive: z.boolean(),
  sortOrder: z.coerce.number().int().min(0).max(999),
});

export async function saveLibraryAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = str(form, "id");
  const parsed = libSchema.safeParse({
    name: str(form, "name"), shortName: str(form, "shortName"), building: str(form, "building"), address: str(form, "address"),
    description: str(form, "description"), open: str(form, "open"), close: str(form, "close"),
    workDays: form.getAll("workDays").map(String), isActive: form.get("isActive") === "1", sortOrder: str(form, "sortOrder") || "0",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const openMinute = parseHHMM(parsed.data.open);
  const closeMinute = parseHHMM(parsed.data.close);
  if (openMinute === null || closeMinute === null || closeMinute <= openMinute) return { error: "İş saatları yanlışdır." };
  const data = {
    name: parsed.data.name, shortName: parsed.data.shortName, building: parsed.data.building,
    address: parsed.data.address || null, description: parsed.data.description || null,
    openMinute, closeMinute, workDays: [...new Set(parsed.data.workDays)].sort().join(","),
    isActive: parsed.data.isActive, sortOrder: parsed.data.sortOrder,
  };
  if (id) {
    await db.library.update({ where: { id }, data });
    await audit(admin.id, "library.updated", "Library", id, data);
    revalidatePath("/admin/kitabxanalar");
    return { ok: "Kitabxana yeniləndi." };
  }
  let slug = slugify(parsed.data.shortName || parsed.data.name) || `kitabxana-${Date.now()}`;
  if (await db.library.findUnique({ where: { slug } })) slug = `${slug}-${crypto.randomBytes(2).toString("hex")}`;
  const lib = await db.library.create({ data: { ...data, slug } });
  await audit(admin.id, "library.created", "Library", lib.id, data);
  go(`/admin/kitabxanalar/${lib.id}`, { ok: "Yeni kitabxana yaradıldı. İndi otaqları əlavə edin." });
}

const roomSchema = z.object({
  name: z.string().trim().min(1).max(60),
  code: z.string().trim().max(20).optional(),
  capacity: z.coerce.number().int().min(1).max(30),
  description: z.string().trim().max(1000).optional(),
  features: z.string().trim().max(1000).optional(),
  sortOrder: z.coerce.number().int().min(0).max(999),
  isActive: z.boolean(),
});

export async function saveRoomAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = str(form, "id");
  const libraryId = str(form, "libraryId");
  const parsed = roomSchema.safeParse({
    name: str(form, "name"), code: str(form, "code"), capacity: str(form, "capacity") || "8", description: str(form, "description"),
    features: str(form, "features"), sortOrder: str(form, "sortOrder") || "0", isActive: form.get("isActive") === "1",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const data = { ...parsed.data, code: parsed.data.code || null, description: parsed.data.description || null, features: parsed.data.features ?? "" };
  if (id) {
    await db.room.update({ where: { id }, data });
    await audit(admin.id, "room.updated", "Room", id, data);
  } else {
    let slug = slugify(data.code || data.name) || `otaq-${Date.now()}`;
    if (await db.room.findUnique({ where: { libraryId_slug: { libraryId, slug } } })) slug = `${slug}-${crypto.randomBytes(2).toString("hex")}`;
    const room = await db.room.create({ data: { ...data, libraryId, slug, qrToken: qrToken() } });
    await audit(admin.id, "room.created", "Room", room.id, data);
  }
  revalidatePath(`/admin/kitabxanalar/${libraryId}`);
  return { ok: id ? "Otaq yeniləndi." : "Otaq əlavə edildi." };
}

const eqSchema = z.object({
  type: z.enum(["LAPTOP", "ADAPTER"]),
  assetTag: z.string().trim().min(2).max(20).regex(/^[A-Za-z0-9-]+$/, "Etiket yalnız hərf, rəqəm və '-' ola bilər"),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(500).optional(),
  libraryId: z.string().min(1),
  isActive: z.boolean(),
});

export async function saveEquipmentAction(_prev: FormState, form: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = str(form, "id");
  const parsed = eqSchema.safeParse({
    type: str(form, "type"), assetTag: str(form, "assetTag").toUpperCase(), name: str(form, "name"), description: str(form, "description"),
    notes: str(form, "notes"), libraryId: str(form, "libraryId"), isActive: form.get("isActive") === "1",
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const dup = await db.equipment.findUnique({ where: { assetTag: parsed.data.assetTag } });
  if (dup && dup.id !== id) return { error: "Bu etiket nömrəsi artıq istifadə olunur." };
  const data = { ...parsed.data, description: parsed.data.description || null, notes: parsed.data.notes || null };
  if (id) {
    await db.equipment.update({ where: { id }, data });
    await audit(admin.id, "equipment.updated", "Equipment", id, data);
  } else {
    const e = await db.equipment.create({
      data: { ...data, qrToken: qrToken(), photoUrl: data.type === "LAPTOP" ? "/media/equipment/noutbuk-a.jpg" : "/media/equipment/adapter.svg" },
    });
    await audit(admin.id, "equipment.created", "Equipment", e.id, data);
  }
  revalidatePath("/admin/kitabxanalar", "layout");
  return { ok: id ? "Avadanlıq yeniləndi." : "Avadanlıq əlavə edildi." };
}

export async function rotateQrAction(form: FormData) {
  const admin = await requireAdmin();
  const kind = str(form, "kind");
  const id = str(form, "id");
  if (kind === "room") await db.room.update({ where: { id }, data: { qrToken: qrToken() } });
  else await db.equipment.update({ where: { id }, data: { qrToken: qrToken() } });
  await audit(admin.id, "qr.rotated", kind === "room" ? "Room" : "Equipment", id);
  go(back(form, "/admin/qr"), { ok: "Yeni QR kod yaradıldı. Köhnə kod artıq işləmir — yenisini çap edib yapışdırın." });
}

// ── Fotolar ──────────────────────────────────────────────────────────

const ALLOWED = new Map([["image/jpeg", "jpg"], ["image/png", "png"], ["image/webp", "webp"]]);

async function storeImage(file: File, folder: string): Promise<string> {
  const ext = ALLOWED.get(file.type);
  if (!ext) throw new Error("Yalnız JPG, PNG və ya WEBP şəkil yükləmək olar.");
  if (file.size > 4 * 1024 * 1024) throw new Error("Şəklin ölçüsü 4 MB-dan çox olmamalıdır.");
  const buf = Buffer.from(await file.arrayBuffer());
  // Sadə məzmun yoxlaması (magic bytes)
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

export async function uploadRoomPhotoAction(form: FormData) {
  const admin = await requireAdmin();
  const roomId = str(form, "roomId");
  const room = await db.room.findUniqueOrThrow({ where: { id: roomId } });
  const file = form.get("photo");
  if (!(file instanceof File) || !file.size) go(`/admin/kitabxanalar/${room.libraryId}`, { err: "Şəkil seçin." });
  try {
    const url = await storeImage(file, `rooms/${roomId}`);
    const count = await db.roomPhoto.count({ where: { roomId } });
    await db.roomPhoto.create({ data: { roomId, url, alt: room.name, sortOrder: count } });
    await audit(admin.id, "room.photo.added", "Room", roomId, { url });
  } catch (e) {
    go(`/admin/kitabxanalar/${room.libraryId}`, { err: (e as Error).message });
  }
  go(`/admin/kitabxanalar/${room.libraryId}`, { ok: "Şəkil əlavə edildi." });
}

export async function deleteRoomPhotoAction(form: FormData) {
  const admin = await requireAdmin();
  const photo = await db.roomPhoto.findUniqueOrThrow({ where: { id: str(form, "photoId") }, include: { room: true } });
  await db.roomPhoto.delete({ where: { id: photo.id } });
  if (photo.url.startsWith("/files/")) {
    const p = path.resolve(env.storageDir, photo.url.replace(/^\/files\//, ""));
    if (p.startsWith(path.resolve(env.storageDir))) await fs.rm(p, { force: true });
  }
  await audit(admin.id, "room.photo.deleted", "Room", photo.roomId, { url: photo.url });
  go(`/admin/kitabxanalar/${photo.room.libraryId}`, { ok: "Şəkil silindi." });
}

export async function uploadEquipmentPhotoAction(form: FormData) {
  const admin = await requireAdmin();
  const id = str(form, "equipmentId");
  const eq = await db.equipment.findUniqueOrThrow({ where: { id } });
  const file = form.get("photo");
  if (!(file instanceof File) || !file.size) go(`/admin/kitabxanalar/${eq.libraryId}`, { err: "Şəkil seçin." });
  try {
    const url = await storeImage(file, `equipment/${id}`);
    await db.equipment.update({ where: { id }, data: { photoUrl: url } });
    await audit(admin.id, "equipment.photo", "Equipment", id, { url });
  } catch (e) {
    go(`/admin/kitabxanalar/${eq.libraryId}`, { err: (e as Error).message });
  }
  go(`/admin/kitabxanalar/${eq.libraryId}`, { ok: "Şəkil yeniləndi." });
}
