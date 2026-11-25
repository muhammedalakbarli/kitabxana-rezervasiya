/**
 * "Boş olarsa məni məlumatlandır" — növbə sistemi.
 * Vaxt boşaldıqda (ləğv, gəlmədi, qısaltma) növbədəki ilk uyğun istifadəçiyə bildiriş gedir
 * və həmin vaxt qısa müddətə (standart 10 dəq) onun üçün saxlanılır. Rezerv etməsə — növbəti.
 */
import type { User } from "@prisma/client";
import { db } from "./db";
import { notify } from "./notify";
import { audit } from "./audit";
import { getRules } from "./settings";
import { blockingIntervals, closedDaysFor, roomBlocks } from "./availability";
import { isWorkDay, roomHours, subtractIntervals } from "./rules";
import { MINUTE, addDays, dayKey, fmtDay, fmtRange, fmtTime, zoned } from "./time";
import type { Result } from "./reservations";

const fail = (error: string) => ({ ok: false as const, error });
const MAX_ACTIVE_ENTRIES = 3;

export async function joinWaitlist(
  user: User,
  input: { libraryId: string; roomId: string | null; start: Date; end: Date },
): Promise<Result<{ id: string }>> {
  const rules = await getRules();
  const me = await db.user.findUniqueOrThrow({ where: { id: user.id } });
  if (me.blockedAt) return fail("Hesabınız bloklanıb.");
  if (!me.profileCompletedAt) return fail("Əvvəlcə profil məlumatlarınızı tamamlayın.");
  const lib = await db.library.findUnique({ where: { id: input.libraryId } });
  if (!lib || !lib.isActive) return fail("Kitabxana tapılmadı.");
  if (input.roomId) {
    const room = await db.room.findFirst({ where: { id: input.roomId, libraryId: lib.id, isActive: true } });
    if (!room) return fail("Otaq tapılmadı.");
  }
  const now = new Date();
  if (input.end <= now) return fail("Seçilmiş vaxt artıq keçib.");
  if (input.end <= input.start) return fail("Bitmə vaxtı başlanğıcdan sonra olmalıdır.");
  const day = dayKey(input.start);
  if (dayKey(new Date(input.end.getTime() - 1)) !== day) return fail("Vaxt aralığı bir gün daxilində olmalıdır.");
  const closed = await closedDaysFor(lib.id);
  if (!isWorkDay(day, lib, closed)) return fail("Kitabxana həmin gün işləmir.");
  if (day > addDays(dayKey(now), rules.maxAdvanceDays)) return fail(`Ən çox ${rules.maxAdvanceDays} gün əvvəldən növbəyə yazılmaq olar.`);
  const hours = roomHours(lib);
  if (input.start < zoned(day, hours.openMinute) || input.end > zoned(day, hours.closeMinute)) return fail("Vaxt rezervasiya saatları daxilində olmalıdır.");
  const active = await db.waitlistEntry.count({ where: { userId: user.id, status: { in: ["WAITING", "NOTIFIED"] } } });
  if (active >= MAX_ACTIVE_ENTRIES) return fail(`Eyni anda ən çox ${MAX_ACTIVE_ENTRIES} növbə qeydiniz ola bilər.`);
  const dup = await db.waitlistEntry.findFirst({
    where: { userId: user.id, libraryId: lib.id, roomId: input.roomId, status: { in: ["WAITING", "NOTIFIED"] }, startAt: { lt: input.end }, endAt: { gt: input.start } },
  });
  if (dup) return fail("Bu vaxt üçün artıq növbədəsiniz.");
  const e = await db.waitlistEntry.create({
    data: { userId: user.id, libraryId: lib.id, roomId: input.roomId, startAt: input.start, endAt: input.end },
  });
  await audit(user.id, "waitlist.joined", "WaitlistEntry", e.id);
  return { ok: true, id: e.id };
}

export async function cancelWaitlist(user: User, id: string): Promise<Result> {
  const res = await db.waitlistEntry.updateMany({ where: { id, userId: user.id, status: { in: ["WAITING", "NOTIFIED"] } }, data: { status: "CANCELLED" } });
  return res.count ? { ok: true } : fail("Növbə qeydi tapılmadı.");
}

/** Otaqda [from, to) aralığı boşaldı — növbədəki ilk uyğun istifadəçini xəbərdar et. */
export async function releaseRoomRange(roomId: string, fromRaw: Date, toRaw: Date): Promise<void> {
  try {
    const rules = await getRules();
    const now = new Date();
    let from = new Date(Math.max(fromRaw.getTime(), Math.ceil(now.getTime() / MINUTE) * MINUTE));
    let to = toRaw;
    if (to.getTime() - from.getTime() < rules.minDurationMinutes * MINUTE) return;
    const room = await db.room.findUnique({ where: { id: roomId }, include: { library: true } });
    if (!room) return;
    // Aralığın həqiqətən boş qalan hissəsini tap (arada kimsə rezerv etmiş və ya "hold" ola bilər)
    const blocks = await roomBlocks(db, roomId, from, to, null);
    const freeParts = subtractIntervals([{ start: from.getTime(), end: to.getTime() }], blockingIntervals(blocks))
      .filter((iv) => iv.end - iv.start >= rules.minDurationMinutes * MINUTE);
    if (!freeParts.length) return;
    const free = freeParts[0];
    if (freeParts.length > 1) {
      // qalan hissələr üçün də ayrıca növbə yoxlanışı
      for (const extra of freeParts.slice(1)) await releaseRoomRange(roomId, new Date(extra.start), new Date(extra.end));
    }
    from = new Date(free.start);
    to = new Date(free.end);

    const candidates = await db.waitlistEntry.findMany({
      where: {
        status: "WAITING",
        libraryId: room.libraryId,
        OR: [{ roomId }, { roomId: null }],
        startAt: { lt: to },
        endAt: { gt: from },
      },
      include: { user: true },
      orderBy: { createdAt: "asc" },
      take: 25,
    });
    for (const c of candidates) {
      if (c.user.blockedAt) continue;
      const holdStart = new Date(Math.max(from.getTime(), c.startAt.getTime()));
      const holdEnd = new Date(Math.min(to.getTime(), c.endAt.getTime()));
      if (holdEnd.getTime() - holdStart.getTime() < rules.minDurationMinutes * MINUTE) continue;
      // istifadəçinin həmin vaxtda artıq rezervi varsa keç
      const busy = await db.reservationParticipant.count({
        where: { userId: c.userId, inviteStatus: "ACCEPTED", reservation: { status: { in: ["BOOKED", "ACTIVE"] }, startAt: { lt: holdEnd }, endAt: { gt: holdStart } } },
      });
      if (busy) continue;
      const holdUntil = new Date(Math.min(now.getTime() + rules.waitlistHoldMinutes * MINUTE, holdEnd.getTime() - rules.minDurationMinutes * MINUTE));
      if (holdUntil <= now) continue;
      const upd = await db.waitlistEntry.updateMany({
        where: { id: c.id, status: "WAITING" },
        data: { status: "NOTIFIED", notifiedAt: now, holdRoomId: roomId, holdStartAt: holdStart, holdEndAt: holdEnd, holdUntil },
      });
      if (!upd.count) continue;
      const day = dayKey(holdStart);
      const link = `/rezerv?k=${room.library.slug}&otaq=${room.slug}&gun=${day}&bas=${holdStart.getTime()}`;
      await notify(c.userId, {
        type: "waitlist.available",
        title: "Gözlədiyiniz vaxt boşaldı!",
        body: `${room.name} (${room.library.shortName}) ${fmtDay(day)} ${fmtRange(holdStart, holdEnd)} aralığında boşdur. Vaxt ${fmtTime(holdUntil)}-a qədər sizin üçün saxlanılır — indi rezerv edin.`,
        link,
        email: {
          subject: `Otaq boşaldı: ${room.name}, ${fmtRange(holdStart, holdEnd)}`,
          rows: [
            ["Otaq", `${room.name} — ${room.library.name}`],
            ["Boş vaxt", `${fmtDay(day)}, ${fmtRange(holdStart, holdEnd)}`],
            ["Saxlanılır", `${fmtTime(holdUntil)}-a qədər`],
          ],
          ctaLabel: "İndi rezerv et",
        },
      });
      await audit(null, "waitlist.notified", "WaitlistEntry", c.id, { roomId, holdStart, holdEnd });
      return;
    }
  } catch (e) {
    console.error("[waitlist.release]", e);
  }
}

/** Fon tapşırığı: vaxtı bitmiş "hold"ları növbəti istifadəçiyə ötür, keçmiş növbələri bağla. */
export async function processWaitlist(): Promise<number> {
  const now = new Date();
  const expired = await db.waitlistEntry.findMany({ where: { status: "NOTIFIED", holdUntil: { lte: now } }, take: 50 });
  for (const h of expired) {
    const upd = await db.waitlistEntry.updateMany({ where: { id: h.id, status: "NOTIFIED" }, data: { status: "EXPIRED" } });
    if (upd.count && h.holdRoomId && h.holdEndAt) await releaseRoomRange(h.holdRoomId, h.holdStartAt ?? now, h.holdEndAt);
  }
  const stale = await db.waitlistEntry.updateMany({ where: { status: "WAITING", endAt: { lte: now } }, data: { status: "EXPIRED" } });
  return expired.length + stale.count;
}
