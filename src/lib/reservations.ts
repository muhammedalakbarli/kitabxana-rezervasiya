/**
 * Otaq rezervasiyalarının domen məntiqi:
 * yaratma, dəvət, qəbul/rədd, ləğv, QR ilə təsdiq, pəncərənin bağlanması (gəlmədi / qısaltma),
 * əlavə vaxt müraciəti və admin qərarı.
 */
import type { Library, Reservation, Room, User } from "@prisma/client";
import { db, isOverlapError, serializable, type Tx } from "./db";
import { env, isAllowedEmail, mailFromAddress, normalizeEmail } from "./env";
import { buildIcs } from "./ics";
import { notify, notifyStaff } from "./notify";
import { audit } from "./audit";
import { getRules } from "./settings";
import { blockingIntervals, closedDaysFor, roomBlocks, ACTIVE_ROOM_STATUSES } from "./availability";
import { checkInWindow, effectiveEnd, isWorkDay, maxMinutesForCategory, overlaps, requiredInvitees } from "./rules";
import { DEFAULT_ROOM_CAPACITY, GROUP_MIN_MEMBERS, PARTY_LABELS, type PartyCategory } from "./rules-config";
import { MINUTE, addDays, dayKey, fmtDay, fmtDuration, fmtRange, fmtTime, zoned } from "./time";
import { applyBlock } from "./blocks";
import { releaseRoomRange } from "./waitlist";
import { UserError } from "./errors";

export { UserError };

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });

type RoomWithLib = Room & { library: Library };

// ── Təqvim (ICS) ─────────────────────────────────────────────────────

export function reservationIcs(
  r: Pick<Reservation, "id" | "startAt" | "endAt" | "icsSequence" | "partyCategory">,
  room: RoomWithLib,
  attendees: { email: string; name?: string | null }[],
  method: "REQUEST" | "CANCEL",
): string {
  return buildIcs({
    uid: `otaq-${r.id}@kitabxana.qu.edu.az`,
    sequence: r.icsSequence,
    method,
    start: r.startAt,
    end: r.endAt,
    summary: `Kitabxana: ${room.name}${room.code ? ` (${room.code})` : ""}`,
    description: [
      `${room.library.name} — ${room.name}`,
      `Qrup: ${PARTY_LABELS[r.partyCategory as PartyCategory]}`,
      "Rezerv vaxtı çatdıqda otaqdakı QR kodu 5 dəqiqə ərzində skan etməyi unutmayın.",
      `${env.appUrl}/rezervasiyalarim/${r.id}`,
    ].join("\n"),
    location: `${room.library.name}, ${room.library.building} — ${room.name}`,
    url: `${env.appUrl}/rezervasiyalarim/${r.id}`,
    organizer: { email: mailFromAddress(), name: "QU Kitabxana" },
    attendees,
    alarmMinutes: 15,
  });
}

function detailRows(r: Pick<Reservation, "startAt" | "endAt">, room: RoomWithLib): [string, string][] {
  return [
    ["Kitabxana", `${room.library.name} (${room.library.building})`],
    ["Otaq", `${room.name}${room.code ? ` · ${room.code}` : ""}`],
    ["Tarix", fmtDay(dayKey(r.startAt), { year: true })],
    ["Vaxt", fmtRange(r.startAt, r.endAt)],
  ];
}

/** Rezervasiyanın bütün qəbul etmiş iştirakçılarına təqvim yeniləməsi/ləğvi göndər. */
async function sendCalendarUpdate(reservationId: string, method: "REQUEST" | "CANCEL", title: string, body: string, type: string) {
  const r = await db.reservation.findUnique({
    where: { id: reservationId },
    include: { room: { include: { library: true } }, participants: { include: { user: true } } },
  });
  if (!r) return;
  for (const p of r.participants.filter((x) => x.inviteStatus === "ACCEPTED")) {
    await notify(p.userId, {
      type,
      title,
      body,
      link: `/rezervasiyalarim/${r.id}`,
      email: {
        rows: detailRows(r, r.room),
        ics: { method, content: reservationIcs(r, r.room, [{ email: p.user.email, name: p.user.name }], method) },
      },
    });
  }
}

// ── Ümumi yoxlamalar ─────────────────────────────────────────────────

/** İstifadəçinin həmin vaxtda başqa aktiv rezervasiyası (sahib və ya qəbul etmiş iştirakçı) varmı */
async function userHasOverlap(tx: Tx, userId: string, start: Date, end: Date, excludeReservationId?: string) {
  const n = await tx.reservationParticipant.count({
    where: {
      userId,
      inviteStatus: "ACCEPTED",
      reservation: {
        status: { in: [...ACTIVE_ROOM_STATUSES] },
        startAt: { lt: end },
        endAt: { gt: start },
        ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      },
    },
  });
  return n > 0;
}

/** Gün ərzindəki otaq rezervasiyalarının sayı (ləğv olunanlar sayılmır) */
async function userDailyCount(tx: Tx, userId: string, day: string, excludeReservationId?: string) {
  return tx.reservationParticipant.count({
    where: {
      userId,
      inviteStatus: "ACCEPTED",
      reservation: {
        status: { in: ["BOOKED", "ACTIVE", "COMPLETED", "NO_SHOW"] },
        startAt: { gte: zoned(day, 0), lt: zoned(addDays(day, 1), 0) },
        ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      },
    },
  });
}

async function ensureInvitee(tx: Tx, email: string): Promise<User> {
  const e = normalizeEmail(email);
  return (await tx.user.findUnique({ where: { email: e } })) ?? tx.user.create({ data: { email: e } });
}

// ── Rezervasiyanın yaradılması ───────────────────────────────────────

export type CreateRoomReservationInput = {
  roomId: string;
  start: Date;
  end: Date;
  category: PartyCategory;
  headcount?: number | null;
  invitees: string[];
  purpose?: string | null;
  rulesAccepted: boolean;
};

export async function createRoomReservation(actor: User, input: CreateRoomReservationInput): Promise<Result<{ id: string }>> {
  const rules = await getRules();
  const user = await db.user.findUniqueOrThrow({ where: { id: actor.id } });
  if (user.blockedAt) return fail("Hesabınız bloklanıb. Bloku açmaq üçün kitabxana əməkdaşına müraciət edin.");
  if (!input.rulesAccepted) return fail("Rezervasiya üçün kitabxanadan istifadə qaydalarını qəbul etməlisiniz.");
  if (![1, 2, 3, 4].includes(input.category)) return fail("Qrup ölçüsü yanlışdır.");

  const room = await db.room.findUnique({ where: { id: input.roomId }, include: { library: true } });
  if (!room || !room.isActive || !room.library.isActive) return fail("Otaq tapılmadı və ya müvəqqəti əlçatan deyil.");

  const now = new Date();
  let start = new Date(Math.floor(input.start.getTime() / MINUTE) * MINUTE);
  const end = new Date(Math.floor(input.end.getTime() / MINUTE) * MINUTE);
  if (start.getTime() < now.getTime() - 2 * MINUTE) return fail("Seçilmiş başlanğıc vaxtı artıq keçib.");
  if (start < now) start = new Date(Math.floor(now.getTime() / MINUTE) * MINUTE);
  if (end <= start) return fail("Bitmə vaxtı başlanğıcdan sonra olmalıdır.");

  const day = dayKey(start);
  const closed = await closedDaysFor(room.libraryId);
  if (!isWorkDay(day, room.library, closed)) return fail("Kitabxana həmin gün işləmir.");
  if (day > addDays(dayKey(now), rules.maxAdvanceDays)) return fail(`Ən çox ${rules.maxAdvanceDays} gün əvvəldən rezerv etmək olar.`);
  const open = zoned(day, room.library.openMinute);
  const close = zoned(day, room.library.closeMinute);
  if (start < open || end > close) return fail(`Rezervasiya yalnız iş saatlarında (${fmtTime(open)}–${fmtTime(close)}) mümkündür.`);

  const minutes = (end.getTime() - start.getTime()) / MINUTE;
  const maxMin = maxMinutesForCategory(input.category, rules);
  if (minutes > maxMin) return fail(`${PARTY_LABELS[input.category]} üçün maksimum müddət ${fmtDuration(maxMin)}-dır.`);
  if (minutes < rules.minDurationMinutes) return fail(`Minimum müddət ${rules.minDurationMinutes} dəqiqədir.`);

  const capacity = room.capacity || DEFAULT_ROOM_CAPACITY;
  const headcount = input.category === 4 ? Math.max(GROUP_MIN_MEMBERS, input.headcount ?? GROUP_MIN_MEMBERS) : input.category;
  if (headcount > capacity) return fail(`Otağın maksimum tutumu ${capacity} nəfərdir.`);

  const invitees = [...new Set(input.invitees.map(normalizeEmail).filter(Boolean))];
  const need = requiredInvitees(input.category);
  if (invitees.includes(user.email)) return fail("Özünüzü dəvət edə bilməzsiniz.");
  if (invitees.length !== need) {
    return fail(need === 0 ? "1 nəfərlik rezervasiyada dəvət tələb olunmur." : `${PARTY_LABELS[input.category]} üçün ${need} nəfəri universitet e-poçtu ilə dəvət etməlisiniz.`);
  }
  const bad = invitees.find((e) => !isAllowedEmail(e));
  if (bad) return fail(`${bad} — yalnız universitet e-poçtları dəvət oluna bilər.`);

  let created: Reservation;
  try {
    created = await serializable(async (tx) => {
      const blocks = await roomBlocks(tx, room.id, start, end, user.id);
      if (blockingIntervals(blocks).some((b) => overlaps(b, { start: start.getTime(), end: end.getTime() }))) {
        throw new UserError("Bu vaxt artıq tutulub. Zəhmət olmasa başqa vaxt seçin və ya növbəyə yazılın.");
      }
      if (await userHasOverlap(tx, user.id, start, end)) throw new UserError("Həmin vaxtda artıq başqa rezervasiyanız var.");
      if ((await userDailyCount(tx, user.id, day)) >= rules.roomDailyLimit) {
        throw new UserError(`Gün ərzində ən çox ${rules.roomDailyLimit} otaq rezervasiyası etmək olar.`);
      }
      const guestUsers: User[] = [];
      for (const email of invitees) {
        const g = await ensureInvitee(tx, email);
        if (g.blockedAt) throw new UserError(`${email} istifadəçisinin hesabı bloklanıb və dəvət edilə bilməz.`);
        guestUsers.push(g);
      }
      const r = await tx.reservation.create({
        data: {
          roomId: room.id,
          ownerId: user.id,
          startAt: start,
          endAt: end,
          plannedEndAt: end,
          partyCategory: input.category,
          headcount,
          purpose: input.purpose?.trim().slice(0, 300) || null,
          rulesAcceptedAt: now,
          participants: {
            create: [
              { userId: user.id, role: "OWNER", inviteStatus: "ACCEPTED", respondedAt: now },
              ...guestUsers.map((g) => ({ userId: g.id, role: "GUEST" as const, inviteStatus: "PENDING" as const })),
            ],
          },
        },
      });
      // Növbə qeydlərini tamamlanmış kimi işarələ
      await tx.waitlistEntry.updateMany({
        where: {
          userId: user.id,
          status: { in: ["WAITING", "NOTIFIED"] },
          libraryId: room.libraryId,
          startAt: { lt: end },
          endAt: { gt: start },
        },
        data: { status: "FULFILLED", fulfilledReservationId: r.id },
      });
      return r;
    });
  } catch (e) {
    if (e instanceof UserError) return fail(e.message);
    if (isOverlapError(e)) return fail("Bu vaxt artıq tutulub. Zəhmət olmasa başqa vaxt seçin.");
    throw e;
  }

  await audit(user.id, "reservation.created", "Reservation", created.id, { roomId: room.id, start, end, category: input.category });
  await notify(user.id, {
    type: "reservation.created",
    title: "Rezervasiyanız təsdiqləndi",
    body: `${room.name} otağı ${fmtDay(day)} ${fmtRange(start, end)} üçün rezerv olundu. Başlanğıcda otaqdakı QR kodu ${rules.checkInAfterMinutes} dəqiqə ərzində skan edin.`,
    link: `/rezervasiyalarim/${created.id}`,
    email: {
      rows: detailRows(created, room),
      footnote: "Bu məktub təqvim dəvəti ehtiva edir — Outlook təqviminizə avtomatik əlavə olunur.",
      ics: { method: "REQUEST", content: reservationIcs(created, room, [{ email: user.email, name: user.name }], "REQUEST") },
    },
  });
  const guests = await db.reservationParticipant.findMany({ where: { reservationId: created.id, role: "GUEST" }, select: { userId: true } });
  if (guests.length) {
    await notify(guests.map((g) => g.userId), {
      type: "invite.received",
      title: "Otaq rezervasiyasına dəvət",
      body: `${user.name ?? user.email} sizi ${room.name} otağına (${fmtDay(day)}, ${fmtRange(start, end)}) dəvət edir. Dəvəti qəbul edin və başlanğıcda QR kodu skan edin.`,
      link: `/rezervasiyalarim/${created.id}`,
      email: { rows: detailRows(created, room), ctaLabel: "Dəvətə bax" },
    });
  }
  return { ok: true, id: created.id };
}

// ── Dəvətlər ─────────────────────────────────────────────────────────

async function loadForParticipant(reservationId: string) {
  return db.reservation.findUnique({
    where: { id: reservationId },
    include: { room: { include: { library: true } }, participants: { include: { user: true } }, owner: true },
  });
}

/** Rezervasiya hələ dəyişdirilə bilərmi (QR pəncərəsi bağlanmayıb) */
async function stillOpen(r: Pick<Reservation, "status" | "startAt">) {
  const rules = await getRules();
  return r.status === "BOOKED" || (r.status === "ACTIVE" && Date.now() < checkInWindow(r.startAt.getTime(), rules).end);
}

export async function respondToInvite(actor: User, reservationId: string, accept: boolean): Promise<Result> {
  const rules = await getRules();
  const r = await loadForParticipant(reservationId);
  const p = r?.participants.find((x) => x.userId === actor.id && x.role === "GUEST");
  if (!r || !p) return fail("Dəvət tapılmadı.");
  if (!(await stillOpen(r))) return fail("Bu rezervasiya üçün dəvətə cavab vermək vaxtı bitib.");
  if (accept) {
    const me = await db.user.findUniqueOrThrow({ where: { id: actor.id } });
    if (me.blockedAt) return fail("Hesabınız bloklanıb.");
    try {
      await serializable(async (tx) => {
        if (await userHasOverlap(tx, actor.id, r.startAt, r.endAt, r.id)) throw new UserError("Həmin vaxtda artıq başqa rezervasiyanız var.");
        if ((await userDailyCount(tx, actor.id, dayKey(r.startAt), r.id)) >= rules.roomDailyLimit) {
          throw new UserError(`Gün ərzində ən çox ${rules.roomDailyLimit} otaq rezervasiyasında iştirak etmək olar.`);
        }
        await tx.reservationParticipant.update({ where: { id: p.id }, data: { inviteStatus: "ACCEPTED", respondedAt: new Date() } });
      });
    } catch (e) {
      if (e instanceof UserError) return fail(e.message);
      throw e;
    }
    await notify(actor.id, {
      type: "invite.accepted.self",
      title: "Dəvəti qəbul etdiniz",
      body: `${r.room.name}, ${fmtDay(dayKey(r.startAt))} ${fmtRange(r.startAt, r.endAt)}. Başlanğıcda QR kodu skan etməyi unutmayın.`,
      link: `/rezervasiyalarim/${r.id}`,
      email: { rows: detailRows(r, r.room), ics: { method: "REQUEST", content: reservationIcs(r, r.room, [{ email: actor.email, name: actor.name }], "REQUEST") } },
    });
    await notify(r.ownerId, {
      type: "invite.accepted",
      title: "Dəvət qəbul edildi",
      body: `${actor.name ?? actor.email} ${r.room.name} rezervasiyanıza qoşuldu.`,
      link: `/rezervasiyalarim/${r.id}`,
    });
  } else {
    const wasAccepted = p.inviteStatus === "ACCEPTED";
    await db.reservationParticipant.update({ where: { id: p.id }, data: { inviteStatus: "DECLINED", respondedAt: new Date() } });
    if (wasAccepted) {
      await notify(actor.id, {
        type: "invite.left",
        title: "Rezervasiyadan çıxdınız",
        body: `${r.room.name}, ${fmtDay(dayKey(r.startAt))} ${fmtRange(r.startAt, r.endAt)}`,
        email: { ics: { method: "CANCEL", content: reservationIcs(r, r.room, [{ email: actor.email, name: actor.name }], "CANCEL") } },
      });
    }
    await notify(r.ownerId, {
      type: "invite.declined",
      title: "Dəvət rədd edildi",
      body: `${actor.name ?? actor.email} ${r.room.name} rezervasiyanıza qoşulmayacaq. Başqa birini dəvət edə bilərsiniz — əks halda müddət QR ilə təsdiqləyənlərin sayına görə qısalacaq.`,
      link: `/rezervasiyalarim/${r.id}`,
      email: true,
    });
  }
  await audit(actor.id, accept ? "invite.accepted" : "invite.declined", "Reservation", r.id);
  return { ok: true };
}

export async function inviteParticipant(actor: User, reservationId: string, emailRaw: string): Promise<Result> {
  const email = normalizeEmail(emailRaw);
  const r = await loadForParticipant(reservationId);
  if (!r || r.ownerId !== actor.id) return fail("Rezervasiya tapılmadı.");
  if (!(await stillOpen(r))) return fail("QR pəncərəsi bağlandıqdan sonra dəvət göndərmək olmaz.");
  if (!isAllowedEmail(email)) return fail("Yalnız universitet e-poçtları dəvət oluna bilər.");
  if (email === actor.email) return fail("Özünüzü dəvət edə bilməzsiniz.");
  const capacity = r.room.capacity || DEFAULT_ROOM_CAPACITY;
  const activeCount = r.participants.filter((x) => x.inviteStatus !== "DECLINED").length;
  if (activeCount >= capacity) return fail(`Otağın tutumu ${capacity} nəfərdir.`);
  const guest = await db.$transaction(async (tx) => ensureInvitee(tx, email));
  if (guest.blockedAt) return fail("Bu istifadəçinin hesabı bloklanıb.");
  const existing = r.participants.find((x) => x.userId === guest.id);
  if (existing && existing.inviteStatus !== "DECLINED") return fail("Bu istifadəçi artıq dəvət olunub.");
  if (existing) {
    await db.reservationParticipant.update({ where: { id: existing.id }, data: { inviteStatus: "PENDING", invitedAt: new Date(), respondedAt: null } });
  } else {
    await db.reservationParticipant.create({ data: { reservationId: r.id, userId: guest.id, role: "GUEST" } });
  }
  await notify(guest.id, {
    type: "invite.received",
    title: "Otaq rezervasiyasına dəvət",
    body: `${actor.name ?? actor.email} sizi ${r.room.name} otağına (${fmtDay(dayKey(r.startAt))}, ${fmtRange(r.startAt, r.endAt)}) dəvət edir.`,
    link: `/rezervasiyalarim/${r.id}`,
    email: { rows: detailRows(r, r.room), ctaLabel: "Dəvətə bax" },
  });
  await audit(actor.id, "invite.sent", "Reservation", r.id, { email });
  return { ok: true };
}

export async function removeParticipant(actor: User, reservationId: string, participantId: string): Promise<Result> {
  const r = await loadForParticipant(reservationId);
  if (!r || r.ownerId !== actor.id) return fail("Rezervasiya tapılmadı.");
  const p = r.participants.find((x) => x.id === participantId && x.role === "GUEST");
  if (!p) return fail("İştirakçı tapılmadı.");
  if (p.checkedInAt) return fail("QR ilə təsdiqləmiş iştirakçını çıxarmaq olmaz.");
  await db.reservationParticipant.delete({ where: { id: p.id } });
  if (p.inviteStatus === "ACCEPTED") {
    await notify(p.userId, {
      type: "invite.removed",
      title: "Rezervasiyadan çıxarıldınız",
      body: `${r.room.name}, ${fmtDay(dayKey(r.startAt))} ${fmtRange(r.startAt, r.endAt)}`,
      email: { ics: { method: "CANCEL", content: reservationIcs(r, r.room, [{ email: p.user.email, name: p.user.name }], "CANCEL") } },
    });
  }
  return { ok: true };
}

// ── Ləğv / erkən bitirmə ─────────────────────────────────────────────

export async function cancelReservation(actor: User, reservationId: string, opts: { byStaff?: boolean; reason?: string } = {}): Promise<Result> {
  const r = await db.reservation.findUnique({ where: { id: reservationId }, include: { room: { include: { library: true } } } });
  if (!r) return fail("Rezervasiya tapılmadı.");
  if (!opts.byStaff && r.ownerId !== actor.id) return fail("Yalnız rezervasiya sahibi ləğv edə bilər.");
  const now = new Date();

  if (r.status === "BOOKED") {
    const res = await db.reservation.updateMany({
      where: { id: r.id, status: "BOOKED" },
      data: { status: "CANCELLED", cancelledAt: now, cancelReason: opts.reason ?? (opts.byStaff ? "Əməkdaş tərəfindən ləğv edildi" : "İstifadəçi ləğv etdi"), icsSequence: { increment: 1 } },
    });
    if (!res.count) return fail("Rezervasiyanın vəziyyəti dəyişib, səhifəni yeniləyin.");
    await sendCalendarUpdate(r.id, "CANCEL", "Rezervasiya ləğv edildi", `${r.room.name}, ${fmtDay(dayKey(r.startAt))} ${fmtRange(r.startAt, r.endAt)} rezervasiyası ləğv olundu.${opts.reason ? ` Səbəb: ${opts.reason}` : ""}`, "reservation.cancelled");
    await releaseRoomRange(r.roomId, r.startAt, r.endAt);
  } else if (r.status === "ACTIVE") {
    // Otaq erkən boşaldılır — qalan vaxt digərləri üçün açılır
    const endNow = new Date(Math.ceil(now.getTime() / MINUTE) * MINUTE);
    if (endNow >= r.endAt) return fail("Rezervasiya artıq bitib.");
    const newEnd = endNow <= r.startAt ? new Date(r.startAt.getTime() + MINUTE) : endNow;
    const res = await db.reservation.updateMany({
      where: { id: r.id, status: "ACTIVE" },
      data: { status: "COMPLETED", endAt: newEnd, completedAt: now, finalizedAt: r.finalizedAt ?? now, icsSequence: { increment: 1 } },
    });
    if (!res.count) return fail("Rezervasiyanın vəziyyəti dəyişib, səhifəni yeniləyin.");
    await sendCalendarUpdate(r.id, "REQUEST", "Otaq erkən boşaldıldı", `${r.room.name} otağından istifadə ${fmtTime(newEnd)}-da başa çatdı. Təşəkkür edirik!`, "reservation.ended");
    await releaseRoomRange(r.roomId, newEnd, r.endAt);
  } else {
    return fail("Bu rezervasiya artıq aktiv deyil.");
  }
  await audit(actor.id, opts.byStaff ? "reservation.cancelled.staff" : "reservation.cancelled", "Reservation", r.id, { reason: opts.reason });
  return { ok: true };
}

// ── QR ilə giriş təsdiqi ─────────────────────────────────────────────

function ipToInt(ip: string): number | null {
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(ip.replace(/^::ffff:/, ""));
  if (!m) return null;
  return m.slice(1).reduce((acc, x) => (acc << 8) + Number(x), 0) >>> 0;
}
export function ipAllowed(ip: string | null, cidrs: string[]): boolean {
  if (!cidrs.length) return true;
  if (!ip) return false;
  const n = ipToInt(ip);
  if (n === null) return false;
  return cidrs.some((c) => {
    const [base, bitsRaw] = c.split("/");
    const b = ipToInt(base);
    const bits = Number(bitsRaw ?? 32);
    if (b === null) return false;
    const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
    return (n & mask) === (b & mask);
  });
}

export type CheckInLookup =
  | { kind: "ready"; reservation: Reservation; room: RoomWithLib; participantId: string; pendingInvite: boolean }
  | { kind: "already"; reservation: Reservation; room: RoomWithLib }
  | { kind: "early"; reservation: Reservation; room: RoomWithLib; opensAt: Date }
  | { kind: "none"; room: RoomWithLib; freeNow: boolean };

/** QR skan edildikdə istifadəçinin həmin otaqdakı uyğun rezervasiyasını tapır */
export async function lookupCheckIn(user: User, room: RoomWithLib): Promise<CheckInLookup> {
  const rules = await getRules();
  const now = Date.now();
  const parts = await db.reservationParticipant.findMany({
    where: {
      userId: user.id,
      inviteStatus: { not: "DECLINED" },
      reservation: { roomId: room.id, status: { in: [...ACTIVE_ROOM_STATUSES] }, endAt: { gt: new Date(now) } },
    },
    include: { reservation: true },
    orderBy: { reservation: { startAt: "asc" } },
  });
  for (const p of parts) {
    const w = checkInWindow(p.reservation.startAt.getTime(), rules);
    if (p.checkedInAt) return { kind: "already", reservation: p.reservation, room };
    if (now >= w.start && now <= w.end) {
      return { kind: "ready", reservation: p.reservation, room, participantId: p.id, pendingInvite: p.inviteStatus === "PENDING" };
    }
  }
  const upcoming = parts.find((p) => checkInWindow(p.reservation.startAt.getTime(), rules).start > now);
  if (upcoming) {
    return { kind: "early", reservation: upcoming.reservation, room, opensAt: new Date(checkInWindow(upcoming.reservation.startAt.getTime(), rules).start) };
  }
  const blocks = await roomBlocks(db, room.id, new Date(now), new Date(now + rules.minDurationMinutes * MINUTE), user.id);
  return { kind: "none", room, freeNow: blockingIntervals(blocks).length === 0 };
}

export async function performCheckIn(user: User, room: RoomWithLib, ip: string | null): Promise<Result<{ reservationId: string; checkedIn: number; expected: number }>> {
  if (!ipAllowed(ip, env.checkinCidrs)) {
    return fail("QR təsdiqi yalnız universitetin şəbəkəsindən (Wi-Fi) mümkündür. Universitet Wi-Fi-na qoşulub yenidən cəhd edin.");
  }
  const found = await lookupCheckIn(user, room);
  if (found.kind === "already") return { ok: true, reservationId: found.reservation.id, ...(await checkInCounts(found.reservation.id)) };
  if (found.kind === "early") return fail(`Təsdiq ${fmtTime(found.opensAt)}-dan etibarən mümkündür.`);
  if (found.kind === "none") return fail("Bu otaqda hazırda sizə aid təsdiqlənməli rezervasiya yoxdur.");
  if (found.pendingInvite) {
    const res = await respondToInvite(user, found.reservation.id, true);
    if (!res.ok) return res;
  }
  const now = new Date();
  await db.$transaction([
    db.reservationParticipant.update({ where: { id: found.participantId }, data: { checkedInAt: now, checkInMethod: "qr" } }),
    db.reservation.updateMany({ where: { id: found.reservation.id, status: "BOOKED" }, data: { status: "ACTIVE" } }),
  ]);
  await audit(user.id, "reservation.checkin", "Reservation", found.reservation.id, { ip });
  return { ok: true, reservationId: found.reservation.id, ...(await checkInCounts(found.reservation.id)) };
}

async function checkInCounts(reservationId: string) {
  const r = await db.reservation.findUniqueOrThrow({ where: { id: reservationId }, include: { participants: true } });
  return {
    checkedIn: r.participants.filter((p) => p.checkedInAt).length,
    expected: Math.min(r.partyCategory, GROUP_MIN_MEMBERS),
  };
}

/** Əməkdaş tərəfindən əl ilə təsdiq (texniki nasazlıq və s.) */
export async function staffCheckIn(staff: User, participantId: string): Promise<Result> {
  const p = await db.reservationParticipant.findUnique({ where: { id: participantId }, include: { reservation: true } });
  if (!p || !["BOOKED", "ACTIVE"].includes(p.reservation.status)) return fail("İştirakçı və ya aktiv rezervasiya tapılmadı.");
  if (p.reservation.finalizedAt) return fail("QR pəncərəsi artıq bağlanıb.");
  await db.$transaction([
    db.reservationParticipant.update({ where: { id: p.id }, data: { checkedInAt: new Date(), checkInMethod: "staff", inviteStatus: "ACCEPTED" } }),
    db.reservation.updateMany({ where: { id: p.reservationId, status: "BOOKED" }, data: { status: "ACTIVE" } }),
  ]);
  await audit(staff.id, "reservation.checkin.staff", "Reservation", p.reservationId, { participantId });
  return { ok: true };
}

// ── QR pəncərəsinin bağlanması (fon tapşırığı) ───────────────────────

export async function finalizeDueReservations(): Promise<number> {
  const rules = await getRules();
  const cutoff = new Date(Date.now() - rules.checkInAfterMinutes * MINUTE);
  const due = await db.reservation.findMany({
    where: { finalizedAt: null, status: { in: ["BOOKED", "ACTIVE"] }, startAt: { lte: cutoff } },
    select: { id: true },
    take: 100,
  });
  for (const d of due) {
    try {
      await finalizeReservation(d.id);
    } catch (e) {
      console.error("[finalize]", d.id, e);
    }
  }
  return due.length;
}

async function finalizeReservation(id: string) {
  const rules = await getRules();
  const r = await db.reservation.findUnique({
    where: { id },
    include: { participants: true, room: { include: { library: true } }, owner: true },
  });
  if (!r || r.finalizedAt || !["BOOKED", "ACTIVE"].includes(r.status)) return;
  const checkedIn = r.participants.filter((p) => p.checkedInAt).length;
  const now = new Date();
  const newEndMs = effectiveEnd(r.startAt.getTime(), r.endAt.getTime(), checkedIn, rules);

  if (newEndMs === null) {
    // Heç kim gəlməyib → gəlmədi; sahibə xəbərdarlıq (strike)
    const res = await db.reservation.updateMany({
      where: { id, finalizedAt: null },
      data: { status: "NO_SHOW", finalizedAt: now, icsSequence: { increment: 1 } },
    });
    if (!res.count) return;
    const owner = await db.user.update({ where: { id: r.ownerId }, data: { noShowStrikes: { increment: 1 } } });
    await audit(null, "reservation.no_show", "Reservation", id, { strikes: owner.noShowStrikes });
    await sendCalendarUpdate(id, "CANCEL", "Rezervasiya ləğv olundu — gəlmədiniz", `${r.room.name} rezervasiyası QR kod vaxtında skan edilmədiyi üçün avtomatik ləğv olundu. Xəbərdarlıq sayı: ${owner.noShowStrikes}/${rules.noShowLimit}.`, "reservation.no_show");
    if (owner.noShowStrikes >= rules.noShowLimit && !owner.blockedAt) {
      await applyBlock(owner.id, "NO_SHOW_LIMIT", `${owner.noShowStrikes} dəfə rezerv edib gəlməyib`, null);
    }
    await releaseRoomRange(r.roomId, now, r.endAt);
    return;
  }

  const shrink = newEndMs < r.endAt.getTime();
  const res = await db.reservation.updateMany({
    where: { id, finalizedAt: null },
    data: { finalizedAt: now, ...(shrink ? { endAt: new Date(newEndMs), icsSequence: { increment: 1 } } : {}) },
  });
  if (!res.count || !shrink) return;
  const newEnd = new Date(newEndMs);
  await audit(null, "reservation.shortened", "Reservation", id, { checkedIn, from: r.endAt, to: newEnd });
  await sendCalendarUpdate(
    id,
    "REQUEST",
    "Rezervasiya müddəti yeniləndi",
    `${r.room.name} otağında QR ilə ${checkedIn} nəfər təsdiqlədiyi üçün rezervasiya ${fmtTime(newEnd)}-a qədər qısaldıldı.`,
    "reservation.shortened",
  );
  await releaseRoomRange(r.roomId, newEnd, r.endAt);
}

export async function completeEndedReservations(): Promise<number> {
  const now = new Date();
  const res = await db.reservation.updateMany({
    where: { status: "ACTIVE", endAt: { lte: now }, finalizedAt: { not: null } },
    data: { status: "COMPLETED", completedAt: now },
  });
  return res.count;
}

// ── Əlavə vaxt müraciəti (admin əl ilə təsdiqləyir) ──────────────────

export async function requestExtension(actor: User, reservationId: string, minutes: number, reason: string): Promise<Result> {
  const rules = await getRules();
  const r = await db.reservation.findUnique({ where: { id: reservationId }, include: { room: { include: { library: true } }, extensionRequests: true } });
  if (!r || r.ownerId !== actor.id) return fail("Rezervasiya tapılmadı.");
  if (!["BOOKED", "ACTIVE"].includes(r.status) || r.endAt <= new Date()) return fail("Yalnız aktiv rezervasiya üçün əlavə vaxt istəmək olar.");
  if (!Number.isInteger(minutes) || minutes < 15 || minutes > rules.extensionRequestMaxMinutes || minutes % 5 !== 0) {
    return fail(`Əlavə vaxt 15–${rules.extensionRequestMaxMinutes} dəqiqə aralığında olmalıdır.`);
  }
  const text = reason.trim();
  if (text.length < 10) return fail("Zəhmət olmasa səbəbi ətraflı yazın (ən azı 10 simvol).");
  if (r.extensionRequests.some((x) => x.status === "PENDING")) return fail("Bu rezervasiya üçün artıq baxılmamış müraciətiniz var.");
  const req = await db.extensionRequest.create({ data: { reservationId: r.id, requesterId: actor.id, minutes, reason: text.slice(0, 1000) } });
  await audit(actor.id, "extension.requested", "ExtensionRequest", req.id, { minutes });
  await notifyStaff({
    type: "extension.requested",
    title: "Yeni əlavə vaxt müraciəti",
    body: `${actor.name ?? actor.email}: ${r.room.name} (${r.room.library.shortName}), +${minutes} dəq. Səbəb: ${text.slice(0, 140)}`,
    link: `/admin/muracietler`,
  });
  return { ok: true };
}

export async function cancelExtensionRequest(actor: User, requestId: string): Promise<Result> {
  const res = await db.extensionRequest.updateMany({ where: { id: requestId, requesterId: actor.id, status: "PENDING" }, data: { status: "CANCELLED" } });
  return res.count ? { ok: true } : fail("Müraciət tapılmadı.");
}

/** Müraciətin təmin oluna bilib-bilmədiyini yoxlayır (admin üçün göstərici) */
export async function extensionFeasibility(requestId: string): Promise<{ feasible: boolean; reason?: string; newEnd?: Date }> {
  const q = await db.extensionRequest.findUnique({ where: { id: requestId }, include: { reservation: { include: { room: { include: { library: true } } } } } });
  if (!q) return { feasible: false, reason: "Tapılmadı" };
  const r = q.reservation;
  if (!["BOOKED", "ACTIVE"].includes(r.status)) return { feasible: false, reason: "Rezervasiya aktiv deyil" };
  const newEnd = new Date(r.endAt.getTime() + q.minutes * MINUTE);
  const close = zoned(dayKey(r.startAt), r.room.library.closeMinute);
  if (newEnd > close) return { feasible: false, reason: `İş saatı ${fmtTime(close)}-da bitir`, newEnd };
  const blocks = await roomBlocks(db, r.roomId, r.endAt, newEnd, r.ownerId, r.id);
  if (blockingIntervals(blocks).length) return { feasible: false, reason: "Bu vaxtda başqa rezervasiya var", newEnd };
  return { feasible: true, newEnd };
}

export async function decideExtension(staff: User, requestId: string, approve: boolean, note?: string): Promise<Result> {
  const q = await db.extensionRequest.findUnique({ where: { id: requestId }, include: { reservation: { include: { room: { include: { library: true } } } } } });
  if (!q || q.status !== "PENDING") return fail("Müraciət artıq baxılıb və ya tapılmadı.");
  const r = q.reservation;
  if (approve) {
    const feas = await extensionFeasibility(requestId);
    if (!feas.feasible) return fail(`Təmin etmək mümkün deyil: ${feas.reason}.`);
    try {
      await serializable(async (tx) => {
        const blocks = await roomBlocks(tx, r.roomId, r.endAt, feas.newEnd!, r.ownerId, r.id);
        if (blockingIntervals(blocks).length) throw new UserError("Bu vaxtda başqa rezervasiya yaranıb.");
        const upd = await tx.reservation.updateMany({
          where: { id: r.id, status: { in: ["BOOKED", "ACTIVE"] }, endAt: r.endAt },
          data: { endAt: feas.newEnd!, icsSequence: { increment: 1 } },
        });
        if (!upd.count) throw new UserError("Rezervasiya dəyişib, səhifəni yeniləyin.");
        await tx.extensionRequest.update({ where: { id: q.id }, data: { status: "APPROVED", decidedById: staff.id, decidedAt: new Date(), adminNote: note?.trim() || null } });
      });
    } catch (e) {
      if (e instanceof UserError) return fail(e.message);
      if (isOverlapError(e)) return fail("Bu vaxtda başqa rezervasiya var.");
      throw e;
    }
    await sendCalendarUpdate(r.id, "REQUEST", "Əlavə vaxt təsdiqləndi", `${r.room.name} rezervasiyanız ${fmtTime(feas.newEnd!)}-a qədər uzadıldı.${note ? ` Qeyd: ${note}` : ""}`, "extension.approved");
  } else {
    await db.extensionRequest.update({ where: { id: q.id }, data: { status: "REJECTED", decidedById: staff.id, decidedAt: new Date(), adminNote: note?.trim() || null } });
    await notify(q.requesterId, {
      type: "extension.rejected",
      title: "Əlavə vaxt müraciəti rədd edildi",
      body: `${r.room.name}, +${q.minutes} dəq.${note ? ` Qeyd: ${note}` : ""}`,
      link: `/rezervasiyalarim/${r.id}`,
      email: true,
    });
  }
  await audit(staff.id, approve ? "extension.approved" : "extension.rejected", "ExtensionRequest", q.id, { note });
  return { ok: true };
}
