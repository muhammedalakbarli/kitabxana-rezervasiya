/**
 * Domen inteqrasiya testləri — ayrıca test bazasında (kitabxana_test) işləyir.
 * Qaydalar tələb sənədinə uyğun yoxlanılır.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Equipment, Library, Room, User } from "@prisma/client";
import { db } from "@/lib/db";
import { createRoomReservation, finalizeDueReservations, performCheckIn, cancelReservation, respondToInvite, requestExtension, decideExtension } from "@/lib/reservations";
import { joinWaitlist, processWaitlist } from "@/lib/waitlist";
import { createEquipmentReservation, extendEquipmentReservation, issueEquipment, processEquipment, returnEquipment } from "@/lib/equipment";
import { bookableDays } from "@/lib/rules";
import { MINUTE, zoned } from "@/lib/time";

let lib: Library;
let room: Room;
let room2: Room;
let laptop: Equipment;
let day: string;
let n = 0;

async function user(extra: Partial<User> = {}): Promise<User> {
  n++;
  return db.user.create({ data: { email: `t${n}.${Date.now()}@qu.edu.az`, name: `Test ${n}`, profileCompletedAt: new Date(), userType: "STUDENT", ...extra } });
}
const at = (h: number, m = 0) => zoned(day, h * 60 + m);

beforeAll(async () => {
  // Təhlükəsizlik: testlər cədvəlləri təmizləyir — yalnız adında "_test" olan bazada işləsin
  if (!/_test(\?|$)/.test(process.env.DATABASE_URL ?? "")) throw new Error("İnteqrasiya testləri yalnız *_test bazasında işlədilə bilər");
  await db.$executeRawUnsafe(`TRUNCATE "Notification","EmailLog","AuditLog","ExtensionRequest","WaitlistEntry","ReservationParticipant","Reservation","EquipmentReservation","UserBlock","Session","LoginCode","LoginAttempt","RoomPhoto","Room","Equipment","ClosedDay","Library","User","Faculty","Setting" CASCADE`);
  lib = await db.library.create({ data: { slug: "test", name: "Test kitabxanası", shortName: "Test", building: "Test binası" } });
  room = await db.room.create({ data: { libraryId: lib.id, slug: "otaq-1", name: "Otaq 1", qrToken: "TESTROOM01" } });
  room2 = await db.room.create({ data: { libraryId: lib.id, slug: "otaq-2", name: "Otaq 2", qrToken: "TESTROOM02" } });
  laptop = await db.equipment.create({ data: { libraryId: lib.id, type: "LAPTOP", assetTag: "NB-T1", name: "Noutbuk T1", qrToken: "TESTLAP001" } });
  const days = bookableDays(new Date(), lib, 7);
  day = days[1] ?? days[0]; // sabahkı iş günü — "indi" vaxtından asılı olmasın
});

beforeEach(async () => {
  await db.$executeRawUnsafe(`TRUNCATE "ExtensionRequest","WaitlistEntry","ReservationParticipant","Reservation","EquipmentReservation" CASCADE`);
});

describe("otaq rezervasiyası", () => {
  it("1 nəfər 1 saat rezerv edə bilər, 1 saatdan çox — yox", async () => {
    const u = await user();
    const ok = await createRoomReservation(u, { roomId: room.id, start: at(10), end: at(11), category: 1, invitees: [], rulesAccepted: true });
    expect(ok.ok).toBe(true);
    const u2 = await user();
    const bad = await createRoomReservation(u2, { roomId: room2.id, start: at(10), end: at(11, 30), category: 1, invitees: [], rulesAccepted: true });
    expect(bad).toMatchObject({ ok: false });
  });

  it("admin 1 nəfər limitini 1.5 saata qaldıranda 90 dəqiqə mümkündür", async () => {
    await db.setting.upsert({ where: { key: "rules" }, create: { key: "rules", value: JSON.stringify({ soloMaxMinutes: 90 }) }, update: { value: JSON.stringify({ soloMaxMinutes: 90 }) } });
    const { getRules } = await import("@/lib/settings");
    // keşi yeniləmək üçün saveRules istifadə edirik
    const { saveRules } = await import("@/lib/settings");
    const admin = await user({ role: "SUPERADMIN" });
    await saveRules({ ...(await getRules()), soloMaxMinutes: 90 }, admin.id);
    const u = await user();
    const ok = await createRoomReservation(u, { roomId: room.id, start: at(12), end: at(13, 30), category: 1, invitees: [], rulesAccepted: true });
    expect(ok.ok).toBe(true);
    await saveRules({ ...(await getRules()), soloMaxMinutes: 60 }, admin.id);
  });

  it("üst-üstə düşən vaxt rədd edilir", async () => {
    const a = await user();
    const b = await user();
    expect((await createRoomReservation(a, { roomId: room.id, start: at(14), end: at(15), category: 1, invitees: [], rulesAccepted: true })).ok).toBe(true);
    const r = await createRoomReservation(b, { roomId: room.id, start: at(14, 30), end: at(15, 30), category: 1, invitees: [], rulesAccepted: true });
    expect(r).toMatchObject({ ok: false });
  });

  it("eyni anda gələn iki sorğudan yalnız biri qəbul olunur", async () => {
    const [a, b] = [await user(), await user()];
    const res = await Promise.all([
      createRoomReservation(a, { roomId: room2.id, start: at(9), end: at(10), category: 1, invitees: [], rulesAccepted: true }),
      createRoomReservation(b, { roomId: room2.id, start: at(9), end: at(10), category: 1, invitees: [], rulesAccepted: true }),
    ]);
    expect(res.filter((x) => x.ok).length).toBe(1);
  });

  it("2 nəfər üçün dəvət tələb olunur; yalnız @qu.edu.az", async () => {
    const u = await user();
    expect(await createRoomReservation(u, { roomId: room.id, start: at(16), end: at(18), category: 2, invitees: [], rulesAccepted: true })).toMatchObject({ ok: false });
    expect(await createRoomReservation(u, { roomId: room.id, start: at(16), end: at(18), category: 2, invitees: ["x@gmail.com"], rulesAccepted: true })).toMatchObject({ ok: false });
    const g = await user();
    const ok = await createRoomReservation(u, { roomId: room.id, start: at(16), end: at(18), category: 2, invitees: [g.email], rulesAccepted: true });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect((await respondToInvite(g, ok.id, true)).ok).toBe(true);
  });

  it("dəvət yalnız qeydiyyatdan keçmiş tələbəyə (tam e-poçt) göndərilir", async () => {
    const u = await user();
    const r = await createRoomReservation(u, { roomId: room2.id, start: at(16), end: at(18), category: 2, invitees: ["hec.kim.yoxdur@qu.edu.az"], rulesAccepted: true });
    expect(r).toMatchObject({ ok: false });
    if (!r.ok) expect(r.error).toContain("qeydiyyatdan keçmiş tələbə tapılmadı");
  });

  it("profili tamamlanmamış istifadəçi rezerv edə bilmir", async () => {
    const u = await user({ profileCompletedAt: null });
    expect(await createRoomReservation(u, { roomId: room.id, start: at(9), end: at(10), category: 1, invitees: [], rulesAccepted: true })).toMatchObject({ ok: false });
  });

  it("təmirdə olan otaq rezerv oluna bilmir; təmir gələcək rezervləri ləğv edir", async () => {
    const [u, v, admin] = [await user(), await user(), await user({ role: "SUPERADMIN" })];
    const r = await createRoomReservation(u, { roomId: room2.id, start: at(12), end: at(13), category: 1, invitees: [], rulesAccepted: true });
    expect(r.ok).toBe(true);
    const { setRoomMaintenance } = await import("@/lib/management");
    const m = await setRoomMaintenance(admin, room2.id, true, "Kondisioner");
    expect(m.cancelled).toBe(1);
    expect(await createRoomReservation(v, { roomId: room2.id, start: at(14), end: at(15), category: 1, invitees: [], rulesAccepted: true })).toMatchObject({ ok: false });
    await setRoomMaintenance(admin, room2.id, false);
    expect((await createRoomReservation(v, { roomId: room2.id, start: at(14), end: at(15), category: 1, invitees: [], rulesAccepted: true })).ok).toBe(true);
  });

  it("super admin otaq rezervasiyası üçün ilk/son vaxtı dəyişəndə həmin pəncərə tətbiq olunur", async () => {
    await db.library.update({ where: { id: lib.id }, data: { bookingStartMinute: 10 * 60, bookingEndMinute: 17 * 60 } });
    const u = await user();
    expect(await createRoomReservation(u, { roomId: room.id, start: at(9), end: at(10), category: 1, invitees: [], rulesAccepted: true })).toMatchObject({ ok: false });
    expect(await createRoomReservation(u, { roomId: room.id, start: at(16, 30), end: at(17, 30), category: 1, invitees: [], rulesAccepted: true })).toMatchObject({ ok: false });
    expect((await createRoomReservation(u, { roomId: room.id, start: at(16), end: at(17), category: 1, invitees: [], rulesAccepted: true })).ok).toBe(true);
    await db.library.update({ where: { id: lib.id }, data: { bookingStartMinute: null, bookingEndMinute: null } });
  });

  it("iş saatlarından kənar (18:00-dan sonra) rezerv mümkün deyil", async () => {
    const u = await user();
    expect(await createRoomReservation(u, { roomId: room.id, start: at(17, 30), end: at(18, 30), category: 1, invitees: [], rulesAccepted: true })).toMatchObject({ ok: false });
  });

  it("gündəlik limit: eyni gün ikinci rezerv olmur", async () => {
    const u = await user();
    expect((await createRoomReservation(u, { roomId: room.id, start: at(9), end: at(10), category: 1, invitees: [], rulesAccepted: true })).ok).toBe(true);
    expect(await createRoomReservation(u, { roomId: room.id, start: at(11), end: at(12), category: 1, invitees: [], rulesAccepted: true })).toMatchObject({ ok: false });
  });

  it("bloklanmış istifadəçi rezerv edə bilmir", async () => {
    const u = await user({ blockedAt: new Date(), blockedReason: "test" });
    expect(await createRoomReservation(u, { roomId: room.id, start: at(9), end: at(10), category: 1, invitees: [], rulesAccepted: true })).toMatchObject({ ok: false });
  });
});

describe("QR təsdiqi və gəlməmə", () => {
  async function pastReservation(owner: User, opts: { minutesAgo: number; durationMin: number; category?: number; guests?: User[]; roomId?: string }) {
    const start = new Date(Math.floor((Date.now() - opts.minutesAgo * MINUTE) / MINUTE) * MINUTE);
    return db.reservation.create({
      data: {
        roomId: opts.roomId ?? room.id, ownerId: owner.id, startAt: start, endAt: new Date(start.getTime() + opts.durationMin * MINUTE),
        plannedEndAt: new Date(start.getTime() + opts.durationMin * MINUTE), partyCategory: opts.category ?? 1, rulesAcceptedAt: new Date(),
        participants: { create: [{ userId: owner.id, role: "OWNER", inviteStatus: "ACCEPTED" }, ...(opts.guests ?? []).map((g) => ({ userId: g.id, role: "GUEST" as const, inviteStatus: "ACCEPTED" as const }))] },
      },
    });
  }

  it("5 dəqiqə ərzində skan edilməsə → gəlmədi + xəbərdarlıq; 3-cü dəfə → avtomatik blok", async () => {
    const u = await user();
    for (let i = 1; i <= 3; i++) {
      await db.$executeRawUnsafe(`TRUNCATE "ReservationParticipant","Reservation" CASCADE`);
      const r = await pastReservation(u, { minutesAgo: 7, durationMin: 60 });
      await finalizeDueReservations();
      expect((await db.reservation.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("NO_SHOW");
      const fresh = await db.user.findUniqueOrThrow({ where: { id: u.id } });
      expect(fresh.noShowStrikes).toBe(i);
      expect(Boolean(fresh.blockedAt)).toBe(i >= 3);
    }
  });

  it("2 nəfərlik 2 saatlıq rezervdə yalnız 1 nəfər skan edərsə → 1 saata qısalır", async () => {
    const [o, g] = [await user(), await user()];
    const start = new Date(Math.floor(Date.now() / MINUTE) * MINUTE);
    const r = await db.reservation.create({
      data: {
        roomId: room.id, ownerId: o.id, startAt: start, endAt: new Date(start.getTime() + 120 * MINUTE), plannedEndAt: new Date(start.getTime() + 120 * MINUTE),
        partyCategory: 2, rulesAcceptedAt: new Date(),
        participants: { create: [{ userId: o.id, role: "OWNER", inviteStatus: "ACCEPTED" }, { userId: g.id, role: "GUEST", inviteStatus: "ACCEPTED" }] },
      },
    });
    const roomFull = await db.room.findUniqueOrThrow({ where: { id: room.id }, include: { library: true } });
    const ci = await performCheckIn(o, roomFull, null);
    expect(ci.ok).toBe(true);
    expect((await db.reservation.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("ACTIVE");
    // pəncərəni bağlanmış kimi göstərmək üçün başlanğıcı 6 dəq geri çəkirik
    await db.reservation.update({ where: { id: r.id }, data: { startAt: new Date(start.getTime() - 6 * MINUTE), endAt: new Date(start.getTime() + 114 * MINUTE), plannedEndAt: new Date(start.getTime() + 114 * MINUTE) } });
    await finalizeDueReservations();
    const after = await db.reservation.findUniqueOrThrow({ where: { id: r.id } });
    expect((after.endAt.getTime() - after.startAt.getTime()) / MINUTE).toBe(60);
    expect(after.status).toBe("ACTIVE");
  });

  it("QR təsdiqi pəncərədən əvvəl mümkün deyil", async () => {
    const u = await user();
    const res = await createRoomReservation(u, { roomId: room.id, start: at(10), end: at(11), category: 1, invitees: [], rulesAccepted: true });
    expect(res.ok).toBe(true);
    const roomFull = await db.room.findUniqueOrThrow({ where: { id: room.id }, include: { library: true } });
    expect((await performCheckIn(u, roomFull, null)).ok).toBe(false);
  });
});

describe("növbə (boş olarsa məni məlumatlandır)", () => {
  it("ləğv edilən vaxt növbədəki ilk istifadəçiyə saxlanılır, başqası tuta bilmir", async () => {
    const [a, b, c] = [await user(), await user(), await user()];
    const ra = await createRoomReservation(a, { roomId: room.id, start: at(11), end: at(12), category: 1, invitees: [], rulesAccepted: true });
    expect(ra.ok).toBe(true);
    expect((await joinWaitlist(b, { libraryId: lib.id, roomId: room.id, start: at(11), end: at(12) })).ok).toBe(true);
    if (!ra.ok) return;
    expect((await cancelReservation(a, ra.id)).ok).toBe(true);
    const w = await db.waitlistEntry.findFirstOrThrow({ where: { userId: b.id } });
    expect(w.status).toBe("NOTIFIED");
    expect(w.holdRoomId).toBe(room.id);
    // C saxlanılan vaxtı tuta bilmir
    expect(await createRoomReservation(c, { roomId: room.id, start: at(11), end: at(12), category: 1, invitees: [], rulesAccepted: true })).toMatchObject({ ok: false });
    // B tuta bilir və növbə qeydi tamamlanır
    expect((await createRoomReservation(b, { roomId: room.id, start: at(11), end: at(12), category: 1, invitees: [], rulesAccepted: true })).ok).toBe(true);
    expect((await db.waitlistEntry.findFirstOrThrow({ where: { userId: b.id } })).status).toBe("FULFILLED");
  });

  it("saxlama müddəti bitəndə növbəti istifadəçiyə keçir", async () => {
    const [a, b, c] = [await user(), await user(), await user()];
    const ra = await createRoomReservation(a, { roomId: room2.id, start: at(15), end: at(16), category: 1, invitees: [], rulesAccepted: true });
    await joinWaitlist(b, { libraryId: lib.id, roomId: null, start: at(15), end: at(16) });
    await joinWaitlist(c, { libraryId: lib.id, roomId: room2.id, start: at(15), end: at(16) });
    if (!ra.ok) throw new Error(ra.error);
    await cancelReservation(a, ra.id);
    await db.waitlistEntry.updateMany({ where: { userId: b.id }, data: { holdUntil: new Date(Date.now() - 1000) } });
    await processWaitlist();
    expect((await db.waitlistEntry.findFirstOrThrow({ where: { userId: b.id } })).status).toBe("EXPIRED");
    expect((await db.waitlistEntry.findFirstOrThrow({ where: { userId: c.id } })).status).toBe("NOTIFIED");
  });
});

describe("əlavə vaxt müraciəti", () => {
  it("admin boş vaxtda təsdiqləyəndə rezerv uzadılır", async () => {
    const [u, admin] = [await user(), await user({ role: "SUPERADMIN" })];
    const r = await createRoomReservation(u, { roomId: room.id, start: at(13), end: at(14), category: 1, invitees: [], rulesAccepted: true });
    if (!r.ok) throw new Error(r.error);
    expect((await requestExtension(u, r.id, 30, "Təqdimata hazırlıq üçün əlavə vaxt lazımdır")).ok).toBe(true);
    const q = await db.extensionRequest.findFirstOrThrow({ where: { reservationId: r.id } });
    expect((await decideExtension(admin, q.id, true)).ok).toBe(true);
    const after = await db.reservation.findUniqueOrThrow({ where: { id: r.id } });
    expect(after.endAt.getTime()).toBe(at(14, 30).getTime());
  });
});

describe("noutbuk", () => {
  it("3 saat; bir dəfə maksimum 1 saat 30 dəq uzadılır", async () => {
    const u = await user();
    expect(await createEquipmentReservation(u, { equipmentId: laptop.id, start: at(9), end: at(12, 30), rulesAccepted: true })).toMatchObject({ ok: false });
    const r = await createEquipmentReservation(u, { equipmentId: laptop.id, start: at(9), end: at(12), rulesAccepted: true });
    if (!r.ok) throw new Error(r.error);
    expect(await extendEquipmentReservation(u, r.id, 120)).toMatchObject({ ok: false });
    expect((await extendEquipmentReservation(u, r.id, 90)).ok).toBe(true);
    expect(await extendEquipmentReservation(u, r.id, 15)).toMatchObject({ ok: false });
  });

  it("saat 17:00-da maksimum 18:00-a qədər", async () => {
    const u = await user();
    expect(await createEquipmentReservation(u, { equipmentId: laptop.id, start: at(17), end: at(19), rulesAccepted: true })).toMatchObject({ ok: false });
    expect((await createEquipmentReservation(u, { equipmentId: laptop.id, start: at(17), end: at(18), rulesAccepted: true })).ok).toBe(true);
  });

  it("vaxtında qaytarılmayan noutbuk → avtomatik blok", async () => {
    const u = await user();
    const start = new Date(Date.now() - 200 * MINUTE);
    const r = await db.equipmentReservation.create({
      data: { equipmentId: laptop.id, userId: u.id, startAt: start, endAt: new Date(Date.now() - 20 * MINUTE), plannedEndAt: new Date(Date.now() - 20 * MINUTE), status: "ISSUED", issuedAt: start, rulesAcceptedAt: start },
    });
    await processEquipment();
    expect((await db.equipmentReservation.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("OVERDUE");
    expect((await db.user.findUniqueOrThrow({ where: { id: u.id } })).blockedAt).not.toBeNull();
    const staff = await user({ role: "SUPERVISOR" });
    expect((await returnEquipment(staff, r.id)).ok).toBe(true);
  });

  it("təhvil: başlanğıcdan 15 dəq əvvəldən tez olmaz", async () => {
    const u = await user();
    const r = await createEquipmentReservation(u, { equipmentId: laptop.id, start: at(15), end: at(16), rulesAccepted: true });
    if (!r.ok) throw new Error(r.error);
    expect((await issueEquipment(null, r.id)).ok).toBe(false);
  });
});

describe("şifrələr", () => {
  it("scrypt hash yoxlanılır, yanlış şifrə rədd edilir", async () => {
    const { hashPassword, verifyPassword, passwordProblem } = await import("@/lib/password");
    const h = await hashPassword("Kitab2026x");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("Kitab2026x", h)).toBe(true);
    expect(await verifyPassword("kitab2026x", h)).toBe(false);
    expect(passwordProblem("qisa1")).not.toBeNull();
    expect(passwordProblem("yalnizherf")).not.toBeNull();
    expect(passwordProblem("Herf12345")).toBeNull();
  });
});

describe("analitika və saxlama", () => {
  it("hesabat: istifadə, gəlməmə, fakültə və kurs üzrə bölgü", async () => {
    const f = await db.faculty.create({ data: { name: "Test fakültəsi" } });
    const a = await user({ faculty: "Test fakültəsi", facultyId: f.id, course: 2, groupName: "TST1" });
    const start = new Date(Math.floor((Date.now() - 3 * 3600_000) / MINUTE) * MINUTE);
    await db.reservation.create({
      data: { roomId: room.id, ownerId: a.id, startAt: start, endAt: new Date(start.getTime() + 60 * MINUTE), plannedEndAt: new Date(start.getTime() + 60 * MINUTE), partyCategory: 1, status: "COMPLETED", rulesAcceptedAt: start,
        participants: { create: [{ userId: a.id, role: "OWNER", inviteStatus: "ACCEPTED", checkedInAt: start }] } },
    });
    await db.reservation.create({
      data: { roomId: room.id, ownerId: a.id, startAt: new Date(start.getTime() + 90 * MINUTE), endAt: new Date(start.getTime() + 150 * MINUTE), plannedEndAt: new Date(start.getTime() + 150 * MINUTE), partyCategory: 1, status: "NO_SHOW", rulesAcceptedAt: start,
        participants: { create: [{ userId: a.id, role: "OWNER", inviteStatus: "ACCEPTED" }] } },
    });
    const { buildReport } = await import("@/lib/analytics");
    const { dayKey, addDays } = await import("@/lib/time");
    const r = await buildReport({ from: addDays(dayKey(new Date()), -1), to: dayKey(new Date()), libraryId: lib.id });
    expect(r.summary.used).toBe(1);
    expect(r.summary.noShow).toBe(1);
    expect(r.summary.noShowRate).toBe(50);
    expect(r.summary.usedHours).toBe(1);
    expect(r.byFaculty.find((x) => x.label === "Test fakültəsi")?.visits).toBe(1);
    expect(r.byCourse.find((x) => x.key === "2")?.hours).toBe(1);
    expect(r.rows.reservations.length).toBe(2);
  });

  it("Excel faylı etibarlı ZIP strukturuna malikdir", async () => {
    const { buildXlsx } = await import("@/lib/xlsx");
    const buf = buildXlsx([{ name: "Test", rows: [{ Ad: "Əli", Saat: 1.5 }] }]);
    expect(buf[0]).toBe(0x50);
    expect(buf[1]).toBe(0x4b);
    expect(Buffer.from(buf).includes(Buffer.from("xl/worksheets/sheet1.xml"))).toBe(true);
  });

  it("saxlama müddəti bitmiş rezervlər silinir, yenilər qalır", async () => {
    const u = await user();
    const old = new Date(Date.now() - 400 * 86400_000);
    const recent = new Date(Date.now() - 10 * 86400_000);
    for (const t of [old, recent]) {
      await db.reservation.create({ data: { roomId: room.id, ownerId: u.id, startAt: t, endAt: new Date(t.getTime() + 60 * MINUTE), plannedEndAt: new Date(t.getTime() + 60 * MINUTE), partyCategory: 1, status: "COMPLETED", rulesAcceptedAt: t } });
    }
    const { purgeOldData } = await import("@/lib/management");
    await purgeOldData(true);
    const left = await db.reservation.findMany({ where: { ownerId: u.id } });
    expect(left.length).toBe(1);
    expect(left[0].startAt.getTime()).toBe(recent.getTime());
  });
});

describe("supervayzer əhatə dairəsi", () => {
  it("supervayzer yalnız öz kitabxanasına çıxış əldə edir", async () => {
    const { canAccessLibrary } = await import("@/lib/auth");
    const sv = await user({ role: "SUPERVISOR", libraryId: lib.id });
    expect(canAccessLibrary({ user: sv, superAdmin: false, libraryId: lib.id }, lib.id)).toBe(true);
    expect(canAccessLibrary({ user: sv, superAdmin: false, libraryId: lib.id }, "basqa-kitabxana")).toBe(false);
    expect(canAccessLibrary({ user: sv, superAdmin: true, libraryId: null }, "basqa-kitabxana")).toBe(true);
  });
});
