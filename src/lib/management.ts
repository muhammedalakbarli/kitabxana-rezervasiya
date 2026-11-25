/**
 * Super admin struktur əməliyyatları: təmir statusu, silmə (arxivləmə), fakültələr.
 * Təmirə salınan və ya silinən obyektin gələcək rezervləri avtomatik ləğv edilir və iştirakçılara bildiriş gedir.
 */
import type { User } from "@prisma/client";
import { db } from "./db";
import { audit } from "./audit";
import { cancelReservation } from "./reservations";
import { cancelEquipmentReservation } from "./equipment";
import { getRules } from "./settings";

async function cancelFutureRoomReservations(actor: User, roomIds: string[], reason: string): Promise<number> {
  if (!roomIds.length) return 0;
  const rows = await db.reservation.findMany({ where: { roomId: { in: roomIds }, status: "BOOKED", startAt: { gt: new Date() } }, select: { id: true } });
  let n = 0;
  for (const r of rows) if ((await cancelReservation(actor, r.id, { byStaff: true, reason })).ok) n++;
  return n;
}

async function cancelFutureEquipmentReservations(actor: User, equipmentIds: string[]): Promise<number> {
  if (!equipmentIds.length) return 0;
  const rows = await db.equipmentReservation.findMany({ where: { equipmentId: { in: equipmentIds }, status: "BOOKED" }, select: { id: true } });
  let n = 0;
  for (const r of rows) if ((await cancelEquipmentReservation(actor, r.id, true)).ok) n++;
  return n;
}

export async function countFutureRoomReservations(roomId: string) {
  return db.reservation.count({ where: { roomId, status: "BOOKED", startAt: { gt: new Date() } } });
}

export async function setRoomMaintenance(actor: User, roomId: string, on: boolean, note?: string | null) {
  const room = await db.room.update({
    where: { id: roomId },
    data: on ? { underMaintenance: true, maintenanceNote: note || null, maintenanceSince: new Date() } : { underMaintenance: false, maintenanceNote: null, maintenanceSince: null },
  });
  const cancelled = on ? await cancelFutureRoomReservations(actor, [roomId], `Otaq təmirə bağlandı${note ? `: ${note}` : ""}`) : 0;
  await audit(actor.id, "room.maintenance", "Room", roomId, { on, note, cancelled });
  return { room, cancelled };
}

export async function setEquipmentMaintenance(actor: User, equipmentId: string, on: boolean, note?: string | null) {
  await db.equipment.update({
    where: { id: equipmentId },
    data: on ? { underMaintenance: true, maintenanceNote: note || null, maintenanceSince: new Date() } : { underMaintenance: false, maintenanceNote: null, maintenanceSince: null },
  });
  const cancelled = on ? await cancelFutureEquipmentReservations(actor, [equipmentId]) : 0;
  await audit(actor.id, "equipment.maintenance", "Equipment", equipmentId, { on, note, cancelled });
  return { cancelled };
}

/** Otağı sil: tarixçəsi varsa arxivlə (hesabatlar üçün), yoxdursa tam sil */
export async function deleteRoom(actor: User, roomId: string) {
  const history = await db.reservation.count({ where: { roomId } });
  const cancelled = await cancelFutureRoomReservations(actor, [roomId], "Otaq istifadədən çıxarıldı");
  if (history === 0) {
    await db.waitlistEntry.deleteMany({ where: { OR: [{ roomId }, { holdRoomId: roomId }] } });
    await db.room.delete({ where: { id: roomId } });
  } else {
    await db.room.update({ where: { id: roomId }, data: { archivedAt: new Date(), isActive: false } });
  }
  await audit(actor.id, "room.archived", "Room", roomId, { hard: history === 0, cancelled });
  return { cancelled, archived: history > 0 };
}

export async function deleteEquipment(actor: User, equipmentId: string) {
  const history = await db.equipmentReservation.count({ where: { equipmentId } });
  const active = await db.equipmentReservation.count({ where: { equipmentId, status: { in: ["ISSUED", "OVERDUE"] } } });
  if (active) throw new Error("Bu avadanlıq hazırda istifadəçidədir — əvvəlcə qəbul edin.");
  const cancelled = await cancelFutureEquipmentReservations(actor, [equipmentId]);
  if (history === 0) await db.equipment.delete({ where: { id: equipmentId } });
  else await db.equipment.update({ where: { id: equipmentId }, data: { archivedAt: new Date(), isActive: false } });
  await audit(actor.id, "equipment.archived", "Equipment", equipmentId, { hard: history === 0, cancelled });
  return { cancelled, archived: history > 0 };
}

/** Kitabxananı sil (arxivlə): bütün otaq və avadanlıq da arxivlənir, supervayzerlərin təyinatı götürülür */
export async function archiveLibrary(actor: User, libraryId: string) {
  const [rooms, equipment] = await Promise.all([
    db.room.findMany({ where: { libraryId, archivedAt: null }, select: { id: true } }),
    db.equipment.findMany({ where: { libraryId, archivedAt: null }, select: { id: true } }),
  ]);
  const cancelled =
    (await cancelFutureRoomReservations(actor, rooms.map((r) => r.id), "Kitabxana istifadədən çıxarıldı")) +
    (await cancelFutureEquipmentReservations(actor, equipment.map((e) => e.id)));
  const now = new Date();
  await db.$transaction([
    db.room.updateMany({ where: { libraryId, archivedAt: null }, data: { archivedAt: now, isActive: false } }),
    db.equipment.updateMany({ where: { libraryId, archivedAt: null }, data: { archivedAt: now, isActive: false } }),
    db.library.update({ where: { id: libraryId }, data: { archivedAt: now, isActive: false } }),
    db.user.updateMany({ where: { role: "SUPERVISOR", libraryId }, data: { libraryId: null } }),
  ]);
  await audit(actor.id, "library.archived", "Library", libraryId, { cancelled });
  return { cancelled };
}

// ── Məlumatların saxlanma siyasəti (standart 365 gün) ────────────────

const RETENTION_KEY = "retention.lastRun";

export async function purgeOldData(force = false): Promise<number> {
  const last = await db.setting.findUnique({ where: { key: RETENTION_KEY } });
  if (!force && last && Date.now() - new Date(JSON.parse(last.value)).getTime() < 12 * 3600_000) return 0;
  await db.setting.upsert({ where: { key: RETENTION_KEY }, create: { key: RETENTION_KEY, value: JSON.stringify(new Date()) }, update: { value: JSON.stringify(new Date()) } });

  const { retentionDays } = await getRules();
  const cutoff = new Date(Date.now() - retentionDays * 86400_000);
  const short = new Date(Date.now() - 30 * 86400_000);
  const mailCutoff = new Date(Date.now() - Math.min(retentionDays, 90) * 86400_000);
  const res = await db.$transaction([
    db.reservation.deleteMany({ where: { endAt: { lt: cutoff }, status: { notIn: ["BOOKED", "ACTIVE"] } } }),
    db.equipmentReservation.deleteMany({ where: { endAt: { lt: cutoff }, status: { in: ["RETURNED", "CANCELLED", "NO_SHOW"] } } }),
    db.waitlistEntry.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    db.notification.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    db.auditLog.deleteMany({ where: { createdAt: { lt: cutoff } } }),
    db.userBlock.deleteMany({ where: { createdAt: { lt: cutoff }, liftedAt: { not: null } } }),
    db.emailLog.deleteMany({ where: { createdAt: { lt: mailCutoff } } }),
    db.loginAttempt.deleteMany({ where: { createdAt: { lt: short } } }),
    db.loginCode.deleteMany({ where: { createdAt: { lt: short } } }),
    db.session.deleteMany({ where: { expiresAt: { lt: new Date() } } }),
  ]);
  const total = res.reduce((s, r) => s + r.count, 0);
  if (total) await audit(null, "retention.purged", "Setting", RETENTION_KEY, { retentionDays, total });
  return total;
}
