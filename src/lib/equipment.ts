/**
 * Noutbuk və adapter rezervasiyası.
 * - Noutbuk bir istifadəçiyə 3 saat (admin tənzimləyir), yalnız oxu zalında.
 * - Başqası rezerv etməyibsə, bir dəfə ilkin müddətin 50%-i qədər (3 saat → 1 saat 30 dəq) avtomatik uzadılır.
 * - Vaxtında qaytarılmama / gecikmə → avtomatik blok.
 */
import type { Equipment, EquipmentReservation, EquipmentType, Library, User } from "@prisma/client";
import { db, isOverlapError, serializable } from "./db";
import { env, mailFromAddress, normalizeEmail, isAllowedEmail } from "./env";
import { buildIcs } from "./ics";
import { notify, notifyStaff } from "./notify";
import { audit } from "./audit";
import { getRules } from "./settings";
import { closedDaysFor, equipmentBlocks } from "./availability";
import { equipmentExtensionLimit, isWorkDay, overlaps } from "./rules";
import type { Rules } from "./rules-config";
import { applyBlock } from "./blocks";
import { MINUTE, addDays, dayKey, fmtDay, fmtDuration, fmtRange, fmtTime, zoned } from "./time";
import type { Result } from "./reservations";
import { UserError } from "./errors";

const fail = (error: string) => ({ ok: false as const, error });

export const EQUIPMENT_LABELS: Record<EquipmentType, { one: string; many: string }> = {
  LAPTOP: { one: "Noutbuk", many: "Noutbuklar" },
  ADAPTER: { one: "Adapter", many: "Adapterlər" },
};

export function maxMinutesForType(type: EquipmentType, r: Rules) {
  return type === "LAPTOP" ? r.laptopMaxMinutes : r.adapterMaxMinutes;
}

type EqWithLib = Equipment & { library: Library };

function eqIcs(r: Pick<EquipmentReservation, "id" | "startAt" | "endAt" | "icsSequence">, eq: EqWithLib, user: Pick<User, "email" | "name">, method: "REQUEST" | "CANCEL") {
  return buildIcs({
    uid: `avadanliq-${r.id}@kitabxana.qu.edu.az`,
    sequence: r.icsSequence,
    method,
    start: r.startAt,
    end: r.endAt,
    summary: `Kitabxana: ${EQUIPMENT_LABELS[eq.type].one} ${eq.assetTag}`,
    description: [
      `${eq.name} (${eq.assetTag}) — ${eq.library.name}`,
      eq.type === "LAPTOP" ? "Noutbuk yalnız kitabxananın oxu zalında istifadə olunur." : "",
      `Qaytarma vaxtı: ${fmtTime(r.endAt)}. Gecikmə avtomatik bloklanma ilə nəticələnir.`,
      `${env.appUrl}/rezervasiyalarim/avadanliq/${r.id}`,
    ].filter(Boolean).join("\n"),
    location: `${eq.library.name}, ${eq.library.building}`,
    organizer: { email: mailFromAddress(), name: "QU Kitabxana" },
    attendees: [{ email: user.email, name: user.name }],
    alarmMinutes: 15,
  });
}

function rows(r: Pick<EquipmentReservation, "startAt" | "endAt">, eq: EqWithLib): [string, string][] {
  return [
    ["Avadanlıq", `${eq.name} · ${eq.assetTag}`],
    ["Kitabxana", eq.library.name],
    ["Tarix", fmtDay(dayKey(r.startAt), { year: true })],
    ["Vaxt", fmtRange(r.startAt, r.endAt)],
  ];
}

export type CreateEquipmentInput = { equipmentId: string; start: Date; end: Date; rulesAccepted: boolean };

/** Rezervasiya; staff = əməkdaş başqa istifadəçi adına rezerv edirsə (kitabxana masası) */
export async function createEquipmentReservation(
  actor: User,
  input: CreateEquipmentInput & { forEmail?: string },
): Promise<Result<{ id: string }>> {
  const rules = await getRules();
  const byStaff = Boolean(input.forEmail);
  let user: User;
  if (byStaff) {
    const email = normalizeEmail(input.forEmail!);
    if (!isAllowedEmail(email)) return fail("Universitet e-poçtu daxil edin.");
    user = (await db.user.findUnique({ where: { email } })) ?? (await db.user.create({ data: { email } }));
  } else {
    user = await db.user.findUniqueOrThrow({ where: { id: actor.id } });
    if (!user.profileCompletedAt) return fail("Əvvəlcə profil məlumatlarınızı tamamlayın.");
    if (!input.rulesAccepted) return fail("Rezervasiya üçün avadanlıqdan istifadə qaydalarını qəbul etməlisiniz.");
  }
  if (user.blockedAt) return fail(byStaff ? "Bu istifadəçinin hesabı bloklanıb." : "Hesabınız bloklanıb. Bloku açmaq üçün kitabxana əməkdaşına müraciət edin.");

  const eq = await db.equipment.findUnique({ where: { id: input.equipmentId }, include: { library: true } });
  if (!eq || !eq.isActive || eq.archivedAt || !eq.library.isActive) return fail("Avadanlıq tapılmadı və ya əlçatan deyil.");
  if (eq.underMaintenance) return fail(`Bu avadanlıq hazırda təmirdədir${eq.maintenanceNote ? ` (${eq.maintenanceNote})` : ""}.`);

  const now = new Date();
  let start = new Date(Math.floor(input.start.getTime() / MINUTE) * MINUTE);
  const end = new Date(Math.floor(input.end.getTime() / MINUTE) * MINUTE);
  if (start.getTime() < now.getTime() - 2 * MINUTE) return fail("Seçilmiş başlanğıc vaxtı artıq keçib.");
  if (start < now) start = new Date(Math.floor(now.getTime() / MINUTE) * MINUTE);
  if (end <= start) return fail("Bitmə vaxtı başlanğıcdan sonra olmalıdır.");
  const day = dayKey(start);
  const closed = await closedDaysFor(eq.libraryId);
  if (!isWorkDay(day, eq.library, closed)) return fail("Kitabxana həmin gün işləmir.");
  if (day > addDays(dayKey(now), rules.maxAdvanceDays)) return fail(`Ən çox ${rules.maxAdvanceDays} gün əvvəldən rezerv etmək olar.`);
  const open = zoned(day, eq.library.openMinute);
  const close = zoned(day, eq.library.closeMinute);
  if (start < open || end > close) return fail(`Rezervasiya yalnız iş saatlarında (${fmtTime(open)}–${fmtTime(close)}) mümkündür.`);
  const minutes = (end.getTime() - start.getTime()) / MINUTE;
  const maxMin = maxMinutesForType(eq.type, rules);
  if (minutes > maxMin) return fail(`${EQUIPMENT_LABELS[eq.type].one} maksimum ${fmtDuration(maxMin)} müddətinə təqdim olunur.`);
  if (minutes < rules.minDurationMinutes) return fail(`Minimum müddət ${rules.minDurationMinutes} dəqiqədir.`);

  let created: EquipmentReservation;
  try {
    created = await serializable(async (tx) => {
      const blocks = await equipmentBlocks(tx, eq.id, start, end, user.id);
      if (blocks.some((b) => overlaps(b, { start: start.getTime(), end: end.getTime() }))) throw new UserError("Bu vaxt artıq tutulub. Başqa vaxt və ya başqa avadanlıq seçin.");
      const sameType = await tx.equipmentReservation.findMany({
        where: {
          userId: user.id,
          equipment: { type: eq.type },
          status: { in: ["BOOKED", "ISSUED", "OVERDUE", "RETURNED"] },
          startAt: { gte: zoned(day, 0), lt: zoned(addDays(day, 1), 0) },
        },
      });
      if (sameType.length >= rules.equipmentDailyLimit) throw new UserError(`Gün ərzində ən çox ${rules.equipmentDailyLimit} ${EQUIPMENT_LABELS[eq.type].one.toLowerCase()} rezervasiyası mümkündür.`);
      const notReturned = await tx.equipmentReservation.count({ where: { userId: user.id, status: "OVERDUE" } });
      if (notReturned) throw new UserError("Qaytarılmamış avadanlığınız var.");
      return tx.equipmentReservation.create({
        data: {
          equipmentId: eq.id,
          userId: user.id,
          startAt: start,
          endAt: end,
          plannedEndAt: end,
          rulesAcceptedAt: now,
          source: byStaff ? "desk" : "web",
          createdById: actor.id,
        },
      });
    });
  } catch (e) {
    if (e instanceof UserError) return fail(e.message);
    if (isOverlapError(e)) return fail("Bu vaxt artıq tutulub.");
    throw e;
  }
  await audit(actor.id, byStaff ? "equipment.reserved.desk" : "equipment.reserved", "EquipmentReservation", created.id, { equipmentId: eq.id, userId: user.id });
  await notify(user.id, {
    type: "equipment.reserved",
    title: `${EQUIPMENT_LABELS[eq.type].one} rezerv olundu`,
    body: `${eq.name} (${eq.assetTag}) — ${fmtDay(day)}, ${fmtRange(start, end)}. Avadanlığı kitabxana əməkdaşından təhvil alın; başlanğıcdan ${rules.equipmentPickupGraceMinutes} dəqiqə ərzində götürülməsə rezerv ləğv olunur.`,
    link: `/rezervasiyalarim/avadanliq/${created.id}`,
    email: { rows: rows(created, eq), ics: { method: "REQUEST", content: eqIcs(created, eq, user, "REQUEST") } },
  });
  return { ok: true, id: created.id };
}

async function load(id: string) {
  return db.equipmentReservation.findUnique({ where: { id }, include: { equipment: { include: { library: true } }, user: true } });
}

export async function cancelEquipmentReservation(actor: User, id: string, byStaff = false): Promise<Result> {
  const r = await load(id);
  if (!r || (!byStaff && r.userId !== actor.id)) return fail("Rezervasiya tapılmadı.");
  const upd = await db.equipmentReservation.updateMany({
    where: { id, status: "BOOKED" },
    data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: byStaff ? "Əməkdaş ləğv etdi" : "İstifadəçi ləğv etdi", icsSequence: { increment: 1 } },
  });
  if (!upd.count) return fail("Yalnız təhvil verilməmiş rezervasiya ləğv oluna bilər.");
  await notify(r.userId, {
    type: "equipment.cancelled",
    title: "Avadanlıq rezervasiyası ləğv edildi",
    body: `${r.equipment.name} (${r.equipment.assetTag}), ${fmtRange(r.startAt, r.endAt)}`,
    email: { ics: { method: "CANCEL", content: eqIcs({ ...r, icsSequence: r.icsSequence + 1 }, r.equipment, r.user, "CANCEL") } },
  });
  await audit(actor.id, "equipment.cancelled", "EquipmentReservation", id);
  return { ok: true };
}

/** Uzatma: yalnız bir dəfə, ilkin müddətin faizi qədər, başqa rezerv yoxdursa — avtomatik təsdiq */
export async function extendEquipmentReservation(actor: User, id: string, minutes: number): Promise<Result<{ newEnd: Date }>> {
  const rules = await getRules();
  const r = await load(id);
  if (!r || r.userId !== actor.id) return fail("Rezervasiya tapılmadı.");
  if (!["BOOKED", "ISSUED"].includes(r.status) || r.endAt <= new Date()) return fail("Yalnız aktiv rezervasiya uzadıla bilər.");
  if (r.extendedMinutes > 0) return fail("İstifadə müddəti yalnız bir dəfə uzadıla bilər.");
  const original = (r.plannedEndAt.getTime() - r.startAt.getTime()) / MINUTE;
  const limit = equipmentExtensionLimit(original, rules.equipmentExtensionPercent);
  if (!Number.isInteger(minutes) || minutes < 15 || minutes > limit) return fail(`Uzatma 15 dəqiqə ilə ${fmtDuration(limit)} arasında olmalıdır.`);
  const newEnd = new Date(r.endAt.getTime() + minutes * MINUTE);
  const close = zoned(dayKey(r.startAt), r.equipment.library.closeMinute);
  if (newEnd > close) return fail(`Kitabxana ${fmtTime(close)}-da bağlanır — maksimum ${fmtTime(close)}-a qədər uzatmaq olar.`);
  try {
    await serializable(async (tx) => {
      const blocks = await equipmentBlocks(tx, r.equipmentId, r.endAt, newEnd, actor.id, r.id);
      if (blocks.length) throw new UserError("Bu avadanlıq həmin vaxt başqa istifadəçi tərəfindən rezerv olunub.");
      const upd = await tx.equipmentReservation.updateMany({
        where: { id, extendedMinutes: 0, endAt: r.endAt },
        data: { endAt: newEnd, extendedMinutes: minutes, extendedAt: new Date(), icsSequence: { increment: 1 } },
      });
      if (!upd.count) throw new UserError("Rezervasiya dəyişib, səhifəni yeniləyin.");
    });
  } catch (e) {
    if (e instanceof UserError) return fail(e.message);
    if (isOverlapError(e)) return fail("Bu avadanlıq həmin vaxt başqa istifadəçi tərəfindən rezerv olunub.");
    throw e;
  }
  const updated = { ...r, endAt: newEnd, icsSequence: r.icsSequence + 1 };
  await notify(r.userId, {
    type: "equipment.extended",
    title: "İstifadə müddəti uzadıldı",
    body: `${r.equipment.name} (${r.equipment.assetTag}) ${fmtTime(newEnd)}-a qədər. Yeni uzatma mümkün deyil.`,
    link: `/rezervasiyalarim/avadanliq/${r.id}`,
    email: { rows: rows(updated, r.equipment), ics: { method: "REQUEST", content: eqIcs(updated, r.equipment, r.user, "REQUEST") } },
  });
  await audit(actor.id, "equipment.extended", "EquipmentReservation", id, { minutes });
  return { ok: true, newEnd };
}

/** Kitabxana masası: təhvil ver */
export async function issueEquipment(staff: User | null, id: string, method: "desk" | "qr" = "desk"): Promise<Result> {
  const rules = await getRules();
  const r = await load(id);
  if (!r) return fail("Rezervasiya tapılmadı.");
  const now = new Date();
  if (r.status !== "BOOKED") return fail("Bu rezervasiya təhvil verilə bilməz.");
  if (now < new Date(r.startAt.getTime() - 15 * MINUTE)) return fail(`Təhvil ən tez ${fmtTime(new Date(r.startAt.getTime() - 15 * MINUTE))}-dan mümkündür.`);
  if (now >= r.endAt) return fail("Rezervasiya vaxtı bitib.");
  const upd = await db.equipmentReservation.updateMany({ where: { id, status: "BOOKED" }, data: { status: "ISSUED", issuedAt: now, issuedById: staff?.id ?? null } });
  if (!upd.count) return fail("Vəziyyət dəyişib, səhifəni yeniləyin.");
  await notify(r.userId, {
    type: "equipment.issued",
    title: `${EQUIPMENT_LABELS[r.equipment.type].one} təhvil verildi`,
    body: `${r.equipment.name} (${r.equipment.assetTag}). Qaytarma vaxtı: ${fmtTime(r.endAt)}. ${rules.equipmentReturnGraceMinutes} dəqiqədən çox gecikmə avtomatik bloklanma ilə nəticələnir.`,
    link: `/rezervasiyalarim/avadanliq/${r.id}`,
  });
  await audit(staff?.id ?? r.userId, method === "qr" ? "equipment.issued.qr" : "equipment.issued", "EquipmentReservation", id);
  return { ok: true };
}

/** Kitabxana masası: qəbul et (vəziyyət yoxlanılır) */
export async function returnEquipment(staff: User, id: string, note?: string, damaged = false): Promise<Result> {
  const rules = await getRules();
  const r = await load(id);
  if (!r || !["ISSUED", "OVERDUE"].includes(r.status)) return fail("Bu avadanlıq təhvil verilməyib.");
  const now = new Date();
  const upd = await db.equipmentReservation.updateMany({
    where: { id, status: { in: ["ISSUED", "OVERDUE"] } },
    data: { status: "RETURNED", returnedAt: now, returnedById: staff.id, returnNote: note?.trim() || null },
  });
  if (!upd.count) return fail("Vəziyyət dəyişib.");
  const lateMin = Math.round((now.getTime() - r.endAt.getTime()) / MINUTE);
  await audit(staff.id, "equipment.returned", "EquipmentReservation", id, { lateMin, damaged, note });
  if (r.status === "ISSUED" && lateMin > rules.equipmentReturnGraceMinutes) {
    await applyBlock(r.userId, "EQUIPMENT_LATE", `${r.equipment.assetTag} ${lateMin} dəqiqə gecikmə ilə qaytarılıb`, staff.id);
  }
  if (damaged) {
    await applyBlock(r.userId, "MANUAL", `${r.equipment.assetTag} təhvil alındığı vəziyyətdə qaytarılmayıb${note ? `: ${note}` : ""}`, staff.id);
  }
  await notify(r.userId, {
    type: "equipment.returned",
    title: "Avadanlıq qəbul edildi",
    body: `${r.equipment.name} (${r.equipment.assetTag}) qaytarıldı. Təşəkkür edirik!`,
    link: `/rezervasiyalarim/avadanliq/${r.id}`,
  });
  return { ok: true };
}

/** Fon tapşırığı: götürülməyən rezervlər və vaxtında qaytarılmayan avadanlıqlar */
export async function processEquipment(): Promise<number> {
  const rules = await getRules();
  const now = Date.now();
  let n = 0;
  const noPickup = await db.equipmentReservation.findMany({
    where: { status: "BOOKED", startAt: { lte: new Date(now - rules.equipmentPickupGraceMinutes * MINUTE) } },
    include: { equipment: { include: { library: true } }, user: true },
    take: 50,
  });
  for (const r of noPickup) {
    const upd = await db.equipmentReservation.updateMany({ where: { id: r.id, status: "BOOKED" }, data: { status: "NO_SHOW", cancelledAt: new Date(), cancelReason: "Vaxtında götürülmədi", icsSequence: { increment: 1 } } });
    if (!upd.count) continue;
    n++;
    await notify(r.userId, {
      type: "equipment.no_show",
      title: "Avadanlıq rezervasiyası ləğv olundu",
      body: `${r.equipment.name} (${r.equipment.assetTag}) ${rules.equipmentPickupGraceMinutes} dəqiqə ərzində təhvil alınmadığı üçün rezervasiya avtomatik ləğv olundu.`,
      email: { ics: { method: "CANCEL", content: eqIcs({ ...r, icsSequence: r.icsSequence + 1 }, r.equipment, r.user, "CANCEL") } },
    });
    await audit(null, "equipment.no_show", "EquipmentReservation", r.id);
  }
  const overdue = await db.equipmentReservation.findMany({
    where: { status: "ISSUED", endAt: { lte: new Date(now - rules.equipmentReturnGraceMinutes * MINUTE) } },
    include: { equipment: true, user: true },
    take: 50,
  });
  for (const r of overdue) {
    const upd = await db.equipmentReservation.updateMany({ where: { id: r.id, status: "ISSUED" }, data: { status: "OVERDUE", overdueAt: new Date() } });
    if (!upd.count) continue;
    n++;
    await applyBlock(r.userId, "EQUIPMENT_OVERDUE", `${r.equipment.assetTag} vaxtında qaytarılmayıb (qaytarma vaxtı ${fmtTime(r.endAt)})`, null);
    await notifyStaff({
      type: "equipment.overdue",
      title: "Avadanlıq qaytarılmayıb",
      body: `${r.equipment.name} (${r.equipment.assetTag}) — ${r.user.name ?? r.user.email}, qaytarma vaxtı ${fmtTime(r.endAt)}`,
      link: "/admin/avadanliq",
    }, r.equipment.libraryId);
  }
  return n;
}
