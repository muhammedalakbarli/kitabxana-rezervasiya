/**
 * Analitika və hesabatlar. Bütün hesablamalar seçilmiş tarix aralığı (Bakı vaxtı ilə günlər) və
 * əhatə dairəsi (bir kitabxana və ya hamısı) üzrə aparılır. Məlumat həcmi saxlama siyasəti ilə
 * (standart 1 il) məhdud olduğundan aqreqasiya tətbiq səviyyəsində edilir — baza mühərrikindən asılı deyil.
 */
import { db } from "./db";
import { getRules } from "./settings";
import { isWorkDay, roomHours } from "./rules";
import { MINUTE, addDays, dayKey, fmtTime, isoWeekday, minutesOfDay, zoned } from "./time";

export type ReportInput = { from: string; to: string; libraryId: string | null };

type UserLite = { id: string; name: string | null; email: string; faculty: string | null; course: number | null; groupName: string | null; specialty: string | null };

export const COURSE_LABEL = (c: number | null | undefined) => (!c ? "Qeyd edilməyib" : c <= 4 ? `${c}-ci kurs` : `Magistratura ${c - 4}-ci il`);

const round1 = (n: number) => Math.round(n * 10) / 10;
const pct = (a: number, b: number) => (b > 0 ? Math.min(100, Math.round((a / b) * 1000) / 10) : 0);

function daysBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < 800; d = addDays(d, 1)) out.push(d);
  return out;
}

export async function buildReport({ from, to, libraryId }: ReportInput) {
  const rules = await getRules();
  const start = zoned(from, 0);
  const end = zoned(addDays(to, 1), 0);
  const libFilter = libraryId ? { libraryId } : {};
  const userSel = { select: { id: true, name: true, email: true, faculty: true, course: true, groupName: true, specialty: true } } as const;

  const [libraries, rooms, reservations, equipmentRes, extensions, closedDays, waitlistCount] = await Promise.all([
    db.library.findMany({ where: libraryId ? { id: libraryId } : {}, orderBy: { sortOrder: "asc" } }),
    db.room.findMany({ where: { ...libFilter }, include: { library: true }, orderBy: [{ libraryId: "asc" }, { sortOrder: "asc" }] }),
    db.reservation.findMany({
      where: { startAt: { gte: start, lt: end }, room: libFilter },
      include: {
        room: { select: { id: true, name: true, code: true, libraryId: true, library: { select: { shortName: true, name: true } } } },
        owner: userSel,
        participants: { include: { user: userSel } },
      },
      orderBy: { startAt: "asc" },
    }),
    db.equipmentReservation.findMany({
      where: { startAt: { gte: start, lt: end }, equipment: libFilter },
      include: { equipment: { select: { id: true, assetTag: true, name: true, type: true, libraryId: true, library: { select: { shortName: true } } } }, user: userSel },
      orderBy: { startAt: "asc" },
    }),
    db.extensionRequest.findMany({ where: { createdAt: { gte: start, lt: end }, reservation: { room: libFilter } }, select: { status: true, minutes: true } }),
    db.closedDay.findMany({ where: { date: { gte: from, lte: to } }, select: { date: true, libraryId: true } }),
    db.waitlistEntry.count({ where: { createdAt: { gte: start, lt: end }, library: libraryId ? { id: libraryId } : {} } }),
  ]);

  const today = dayKey(new Date());
  const nowMs = Date.now();
  const days = daysBetween(from, to);
  const libById = new Map(libraries.map((l) => [l.id, l]));

  // ── Mövcud (rezerv oluna bilən) otaq-dəqiqələri ────────────────────
  const availableByRoom = new Map<string, number>();
  const availableBySlot = new Map<string, number>(); // "weekday-hour" → otaq-dəqiqə
  for (const room of rooms) {
    const lib = libById.get(room.libraryId) ?? room.library;
    const hours = roomHours(lib);
    const closed = closedDays.filter((c) => c.libraryId === null || c.libraryId === room.libraryId).map((c) => c.date);
    let total = 0;
    for (const d of days) {
      if (d > today) break;
      if (!isWorkDay(d, hours, closed)) continue;
      if (room.archivedAt && d > dayKey(room.archivedAt)) continue;
      const dayStart = zoned(d, hours.openMinute).getTime();
      const dayEnd = Math.min(zoned(d, hours.closeMinute).getTime(), d === today ? nowMs : Infinity);
      if (dayEnd <= dayStart) continue;
      total += (dayEnd - dayStart) / MINUTE;
      for (let h = Math.floor(hours.openMinute / 60); h * 60 < hours.closeMinute; h++) {
        const a = Math.max(dayStart, zoned(d, h * 60).getTime());
        const b = Math.min(dayEnd, zoned(d, h * 60 + 60).getTime());
        if (b > a) {
          const k = `${isoWeekday(d)}-${h}`;
          availableBySlot.set(k, (availableBySlot.get(k) ?? 0) + (b - a) / MINUTE);
        }
      }
    }
    availableByRoom.set(room.id, total);
  }

  // ── Otaq rezervasiyaları ───────────────────────────────────────────
  const isUsed = (s: string) => s === "COMPLETED" || s === "ACTIVE";
  const minutesOf = (r: { startAt: Date; endAt: Date }) => Math.max(0, (r.endAt.getTime() - r.startAt.getTime()) / MINUTE);
  const used = reservations.filter((r) => isUsed(r.status));
  const noShow = reservations.filter((r) => r.status === "NO_SHOW");
  const cancelled = reservations.filter((r) => r.status === "CANCELLED");
  const upcoming = reservations.filter((r) => r.status === "BOOKED");
  const usedMinutes = used.reduce((s, r) => s + minutesOf(r), 0);
  const availableMinutes = [...availableByRoom.values()].reduce((a, b) => a + b, 0);

  const occupiedBySlot = new Map<string, number>();
  for (const r of used) {
    const d = dayKey(r.startAt);
    const wd = isoWeekday(d);
    for (let t = r.startAt.getTime(); t < r.endAt.getTime(); ) {
      const minuteOfDay = minutesOfDay(new Date(t));
      const h = Math.floor(minuteOfDay / 60);
      const hourEnd = zoned(d, h * 60 + 60).getTime();
      const segEnd = Math.min(hourEnd, r.endAt.getTime());
      const k = `${wd}-${h}`;
      occupiedBySlot.set(k, (occupiedBySlot.get(k) ?? 0) + (segEnd - t) / MINUTE);
      t = segEnd;
    }
  }
  const heatHours = new Set<number>();
  for (const k of availableBySlot.keys()) heatHours.add(Number(k.split("-")[1]));
  const heatmap = {
    hours: [...heatHours].sort((a, b) => a - b),
    weekdays: [1, 2, 3, 4, 5, 6, 7].filter((wd) => [...availableBySlot.keys()].some((k) => k.startsWith(`${wd}-`))),
    cell: (wd: number, h: number) => pct(occupiedBySlot.get(`${wd}-${h}`) ?? 0, availableBySlot.get(`${wd}-${h}`) ?? 0),
  };
  const heatmapCells = heatmap.weekdays.map((wd) => ({ weekday: wd, values: heatmap.hours.map((h) => heatmap.cell(wd, h)) }));

  const daily = days.map((d) => {
    const list = reservations.filter((r) => dayKey(r.startAt) === d);
    return {
      day: d,
      total: list.filter((r) => r.status !== "CANCELLED").length,
      used: list.filter((r) => isUsed(r.status)).length,
      noShow: list.filter((r) => r.status === "NO_SHOW").length,
      hours: round1(list.filter((r) => isUsed(r.status)).reduce((s, r) => s + minutesOf(r), 0) / 60),
    };
  });

  const byRoom = rooms
    .map((room) => {
      const list = reservations.filter((r) => r.roomId === room.id);
      const u = list.filter((r) => isUsed(r.status));
      const um = u.reduce((s, r) => s + minutesOf(r), 0);
      return {
        id: room.id,
        name: `${room.name}${room.code ? ` · ${room.code}` : ""}`,
        library: room.library.shortName,
        archived: Boolean(room.archivedAt),
        total: list.filter((r) => r.status !== "CANCELLED").length,
        used: u.length,
        noShow: list.filter((r) => r.status === "NO_SHOW").length,
        hours: round1(um / 60),
        utilization: pct(um, availableByRoom.get(room.id) ?? 0),
      };
    })
    .filter((r) => !r.archived || r.total > 0);

  // ── İstifadəçilər üzrə (QR ilə təsdiqləmiş iştirakçılar) ───────────
  type Agg = { key: string; label: string; visits: number; hours: number; students: Set<string>; noShows: number };
  const groupBy = (keyFn: (u: UserLite) => [string, string]) => {
    const m = new Map<string, Agg>();
    const get = (u: UserLite) => {
      const [key, label] = keyFn(u);
      if (!m.has(key)) m.set(key, { key, label, visits: 0, hours: 0, students: new Set(), noShows: 0 });
      return m.get(key)!;
    };
    for (const r of used) {
      for (const p of r.participants) {
        if (!p.checkedInAt) continue;
        const a = get(p.user);
        a.visits++;
        a.hours += minutesOf(r) / 60;
        a.students.add(p.userId);
      }
    }
    for (const r of noShow) get(r.owner).noShows++;
    return [...m.values()]
      .map((a) => ({ key: a.key, label: a.label, visits: a.visits, hours: round1(a.hours), students: a.students.size, noShows: a.noShows }))
      .sort((a, b) => b.hours - a.hours || b.visits - a.visits);
  };
  const byFaculty = groupBy((u) => [u.faculty ?? "-", u.faculty ?? "Qeyd edilməyib"]);
  const byCourse = groupBy((u) => [String(u.course ?? 0), COURSE_LABEL(u.course)]).sort((a, b) => Number(a.key) - Number(b.key));
  const byGroup = groupBy((u) => [u.groupName ?? "-", u.groupName ?? "Qeyd edilməyib"]).slice(0, 15);

  const studentMap = new Map<string, { user: UserLite; visits: number; hours: number; owned: number; noShows: number }>();
  const st = (u: UserLite) => {
    if (!studentMap.has(u.id)) studentMap.set(u.id, { user: u, visits: 0, hours: 0, owned: 0, noShows: 0 });
    return studentMap.get(u.id)!;
  };
  for (const r of reservations) {
    if (r.status !== "CANCELLED") st(r.owner).owned++;
    if (r.status === "NO_SHOW") st(r.owner).noShows++;
    if (isUsed(r.status)) for (const p of r.participants) if (p.checkedInAt) { const s = st(p.user); s.visits++; s.hours += minutesOf(r) / 60; }
  }
  const topStudents = [...studentMap.values()]
    .filter((s) => s.visits > 0 || s.noShows > 0)
    .sort((a, b) => b.hours - a.hours || b.visits - a.visits)
    .slice(0, 15)
    .map((s) => ({ ...s, hours: round1(s.hours) }));

  const checkedInCounts = used.map((r) => r.participants.filter((p) => p.checkedInAt).length);
  const uniqueUsers = new Set<string>();
  for (const r of used) for (const p of r.participants) if (p.checkedInAt) uniqueUsers.add(p.userId);

  // ── Avadanlıq ──────────────────────────────────────────────────────
  const eqUsed = equipmentRes.filter((r) => r.status === "RETURNED" || r.status === "ISSUED" || r.status === "OVERDUE");
  const eqMinutes = (r: (typeof equipmentRes)[number]) => {
    const s = (r.issuedAt ?? r.startAt).getTime();
    const e = (r.returnedAt ?? (r.status === "ISSUED" ? new Date(Math.min(nowMs, r.endAt.getTime())) : r.endAt)).getTime();
    return Math.max(0, (e - s) / MINUTE);
  };
  const lateMin = (r: (typeof equipmentRes)[number]) => (r.returnedAt ? Math.round((r.returnedAt.getTime() - r.endAt.getTime()) / MINUTE) : r.status === "OVERDUE" ? Math.round((nowMs - r.endAt.getTime()) / MINUTE) : 0);
  const late = equipmentRes.filter((r) => r.status === "OVERDUE" || lateMin(r) > rules.equipmentReturnGraceMinutes);
  const equipmentByItem = new Map<string, { tag: string; name: string; type: string; library: string; reservations: number; hours: number; late: number }>();
  for (const r of equipmentRes) {
    if (r.status === "CANCELLED") continue;
    const k = r.equipment.id;
    if (!equipmentByItem.has(k)) equipmentByItem.set(k, { tag: r.equipment.assetTag, name: r.equipment.name, type: r.equipment.type, library: r.equipment.library.shortName, reservations: 0, hours: 0, late: 0 });
    const e = equipmentByItem.get(k)!;
    e.reservations++;
    if (eqUsed.includes(r)) e.hours += eqMinutes(r) / 60;
    if (late.includes(r)) e.late++;
  }

  // ── Kitabxanalar üzrə müqayisə ─────────────────────────────────────
  const byLibrary = libraries.map((l) => {
    const roomIds = new Set(rooms.filter((r) => r.libraryId === l.id).map((r) => r.id));
    const list = reservations.filter((r) => roomIds.has(r.roomId));
    const u = list.filter((r) => isUsed(r.status));
    const um = u.reduce((s, r) => s + minutesOf(r), 0);
    const avail = [...roomIds].reduce((s, id) => s + (availableByRoom.get(id) ?? 0), 0);
    const ns = list.filter((r) => r.status === "NO_SHOW").length;
    const eq = equipmentRes.filter((r) => r.equipment.libraryId === l.id && r.status !== "CANCELLED");
    return {
      id: l.id,
      name: l.name,
      archived: Boolean(l.archivedAt),
      rooms: roomIds.size,
      total: list.filter((r) => r.status !== "CANCELLED").length,
      used: u.length,
      hours: round1(um / 60),
      utilization: pct(um, avail),
      noShowRate: pct(ns, u.length + ns),
      equipment: eq.length,
    };
  });

  const summary = {
    total: reservations.length - cancelled.length,
    used: used.length,
    noShow: noShow.length,
    cancelled: cancelled.length,
    upcoming: upcoming.length,
    usedHours: round1(usedMinutes / 60),
    utilization: pct(usedMinutes, availableMinutes),
    noShowRate: pct(noShow.length, used.length + noShow.length),
    uniqueUsers: uniqueUsers.size,
    avgParty: checkedInCounts.length ? round1(checkedInCounts.reduce((a, b) => a + b, 0) / checkedInCounts.length) : 0,
    groupShare: pct(used.filter((r) => r.partyCategory > 1).length, used.length),
    waitlist: waitlistCount,
    extensions: {
      total: extensions.length,
      approved: extensions.filter((e) => e.status === "APPROVED").length,
      rejected: extensions.filter((e) => e.status === "REJECTED").length,
      pending: extensions.filter((e) => e.status === "PENDING").length,
    },
    equipment: {
      total: equipmentRes.filter((r) => r.status !== "CANCELLED").length,
      used: eqUsed.length,
      notPicked: equipmentRes.filter((r) => r.status === "NO_SHOW").length,
      late: late.length,
      hours: round1(eqUsed.reduce((s, r) => s + eqMinutes(r), 0) / 60),
      laptops: equipmentRes.filter((r) => r.equipment.type === "LAPTOP" && r.status !== "CANCELLED").length,
      adapters: equipmentRes.filter((r) => r.equipment.type === "ADAPTER" && r.status !== "CANCELLED").length,
    },
  };

  // ── Export üçün sətirlər ───────────────────────────────────────────
  const STATUS_AZ: Record<string, string> = { BOOKED: "Rezerv olunub", ACTIVE: "İstifadədə", COMPLETED: "Başa çatıb", CANCELLED: "Ləğv edilib", NO_SHOW: "Gəlmədi", ISSUED: "Təhvil verilib", RETURNED: "Qaytarılıb", OVERDUE: "Qaytarılmayıb" };
  const reservationRows = reservations.map((r) => ({
    Tarix: dayKey(r.startAt),
    Başlanğıc: fmtTime(r.startAt),
    Bitmə: fmtTime(r.endAt),
    "Müddət (dəq)": Math.round(minutesOf(r)),
    Kitabxana: r.room.library.shortName,
    Otaq: `${r.room.name}${r.room.code ? ` (${r.room.code})` : ""}`,
    "Rezerv edən": r.owner.name ?? "",
    "E-poçt": r.owner.email,
    Fakültə: r.owner.faculty ?? "",
    İxtisas: r.owner.specialty ?? "",
    Kurs: r.owner.course ?? "",
    Qrup: r.owner.groupName ?? "",
    "Qrup kateqoriyası": r.partyCategory === 4 ? `4+ (${r.headcount ?? 4})` : r.partyCategory,
    "QR ilə təsdiqləyən": r.participants.filter((p) => p.checkedInAt).length,
    Status: STATUS_AZ[r.status] ?? r.status,
    Məqsəd: r.purpose ?? "",
  }));
  const participantRows = reservations.flatMap((r) =>
    r.participants.map((p) => ({
      Tarix: dayKey(r.startAt),
      Vaxt: `${fmtTime(r.startAt)}–${fmtTime(r.endAt)}`,
      Kitabxana: r.room.library.shortName,
      Otaq: r.room.name,
      Tələbə: p.user.name ?? "",
      "E-poçt": p.user.email,
      Fakültə: p.user.faculty ?? "",
      Kurs: p.user.course ?? "",
      Qrup: p.user.groupName ?? "",
      Rol: p.role === "OWNER" ? "Rezerv edən" : "Dəvətli",
      Dəvət: p.inviteStatus === "ACCEPTED" ? "Qəbul edib" : p.inviteStatus === "DECLINED" ? "Rədd edib" : "Gözləyir",
      "QR təsdiq": p.checkedInAt ? fmtTime(p.checkedInAt) : "",
      "Rezerv statusu": STATUS_AZ[r.status] ?? r.status,
    })),
  );
  const equipmentRows = equipmentRes.map((r) => ({
    Tarix: dayKey(r.startAt),
    Başlanğıc: fmtTime(r.startAt),
    Bitmə: fmtTime(r.endAt),
    Kitabxana: r.equipment.library.shortName,
    Avadanlıq: `${r.equipment.name} (${r.equipment.assetTag})`,
    Növ: r.equipment.type === "LAPTOP" ? "Noutbuk" : "Adapter",
    İstifadəçi: r.user.name ?? "",
    "E-poçt": r.user.email,
    Fakültə: r.user.faculty ?? "",
    Kurs: r.user.course ?? "",
    Qrup: r.user.groupName ?? "",
    Status: STATUS_AZ[r.status] ?? r.status,
    "Təhvil verilib": r.issuedAt ? fmtTime(r.issuedAt) : "",
    Qaytarılıb: r.returnedAt ? `${dayKey(r.returnedAt)} ${fmtTime(r.returnedAt)}` : "",
    "Uzatma (dəq)": r.extendedMinutes || "",
    "Gecikmə (dəq)": Math.max(0, lateMin(r)) || "",
  }));

  return {
    range: { from, to },
    libraryId,
    libraryName: libraryId ? libraries[0]?.name ?? "" : "Bütün kitabxanalar",
    summary,
    daily,
    heatmap: { hours: heatmap.hours, rows: heatmapCells },
    byRoom,
    byLibrary,
    byFaculty,
    byCourse,
    byGroup,
    topStudents,
    equipmentByItem: [...equipmentByItem.values()].map((e) => ({ ...e, hours: round1(e.hours) })).sort((a, b) => b.reservations - a.reservations),
    rows: { reservations: reservationRows, participants: participantRows, equipment: equipmentRows },
  };
}

export type Report = Awaited<ReturnType<typeof buildReport>>;
