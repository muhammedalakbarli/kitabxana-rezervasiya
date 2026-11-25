import type { Library } from "@prisma/client";
import { db, type Tx } from "./db";
import { getRules } from "./settings";
import { dayWindow, roomHours, startOptions, subtractIntervals, type Interval, type LibraryHours, type StartOption } from "./rules";
import { dayKey, zoned } from "./time";

type Client = Tx | typeof db;

export type BlockKind = "booked" | "active" | "mine" | "hold" | "hold-mine";
export type BusyBlock = Interval & {
  kind: BlockKind;
  reservationId?: string;
  ownerName?: string | null;
  ownerEmail?: string;
};

export const ACTIVE_ROOM_STATUSES = ["BOOKED", "ACTIVE"] as const;
export const ACTIVE_EQUIPMENT_STATUSES = ["BOOKED", "ISSUED", "OVERDUE"] as const;

export async function closedDaysFor(libraryId: string, client: Client = db): Promise<string[]> {
  const today = dayKey(new Date());
  const rows = await client.closedDay.findMany({
    where: { date: { gte: today }, OR: [{ libraryId }, { libraryId: null }] },
    select: { date: true },
  });
  return rows.map((r) => r.date);
}

/** Otağın məşğul blokları (rezervlər + növbə üçün saxlanılan vaxtlar). */
export async function roomBlocks(
  client: Client,
  roomId: string,
  from: Date,
  to: Date,
  viewerId?: string | null,
  excludeReservationId?: string,
): Promise<BusyBlock[]> {
  const now = new Date();
  const [reservations, holds] = await Promise.all([
    client.reservation.findMany({
      where: {
        roomId,
        status: { in: [...ACTIVE_ROOM_STATUSES] },
        startAt: { lt: to },
        endAt: { gt: from },
        ...(excludeReservationId ? { id: { not: excludeReservationId } } : {}),
      },
      select: {
        id: true, startAt: true, endAt: true, status: true,
        owner: { select: { name: true, email: true } },
        participants: { select: { userId: true, inviteStatus: true } },
      },
      orderBy: { startAt: "asc" },
    }),
    client.waitlistEntry.findMany({
      where: {
        holdRoomId: roomId,
        status: "NOTIFIED",
        holdUntil: { gt: now },
        holdStartAt: { lt: to },
        holdEndAt: { gt: from },
      },
      select: { userId: true, holdStartAt: true, holdEndAt: true },
    }),
  ]);
  const blocks: BusyBlock[] = reservations.map((r) => {
    const mine = viewerId && r.participants.some((p) => p.userId === viewerId && p.inviteStatus !== "DECLINED");
    return {
      start: r.startAt.getTime(),
      end: r.endAt.getTime(),
      kind: mine ? "mine" : r.status === "ACTIVE" ? "active" : "booked",
      reservationId: r.id,
      ownerName: r.owner.name,
      ownerEmail: r.owner.email,
    };
  });
  for (const h of holds) {
    blocks.push({
      start: h.holdStartAt!.getTime(),
      end: h.holdEndAt!.getTime(),
      kind: h.userId === viewerId ? "hold-mine" : "hold",
    });
  }
  return blocks.sort((a, b) => a.start - b.start);
}

/** Rezerv üçün maneə olan intervallar (istifadəçinin öz "hold"u maneə deyil). */
export const blockingIntervals = (blocks: BusyBlock[]): Interval[] =>
  blocks.filter((b) => b.kind !== "hold-mine").map(({ start, end }) => ({ start, end }));

export type RoomDay = {
  window: Interval | null;
  open: number;
  close: number;
  blocks: BusyBlock[];
  free: Interval[];
  starts: StartOption[];
};

export async function roomDay(
  roomId: string,
  library: Pick<Library, "id" | "workDays"> & LibraryHours,
  day: string,
  viewerId?: string | null,
  opts: { unavailable?: boolean } = {},
): Promise<RoomDay> {
  const rules = await getRules();
  const closed = await closedDaysFor(library.id);
  const hours = roomHours(library);
  const open = zoned(day, hours.openMinute).getTime();
  const close = zoned(day, hours.closeMinute).getTime();
  const blocks = await roomBlocks(db, roomId, new Date(open), new Date(close), viewerId);
  const window = opts.unavailable ? null : dayWindow(day, hours, new Date(), closed);
  const free = window ? subtractIntervals([window], blockingIntervals(blocks)) : [];
  return { window, open, close, blocks, free, starts: startOptions(free, rules.slotStepMinutes, rules.minDurationMinutes) };
}

// ── Avadanlıq ────────────────────────────────────────────────────────

export async function equipmentBlocks(
  client: Client,
  equipmentId: string,
  from: Date,
  to: Date,
  viewerId?: string | null,
  excludeId?: string,
): Promise<BusyBlock[]> {
  const now = Date.now();
  const rows = await client.equipmentReservation.findMany({
    where: {
      equipmentId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: [
        { status: { in: ["BOOKED", "ISSUED"] }, startAt: { lt: to }, endAt: { gt: from } },
        // Qaytarılmamış avadanlıq qaytarılana qədər məşğul sayılır
        { status: "OVERDUE" },
        { status: "ISSUED", endAt: { lte: from } },
      ],
    },
    select: { id: true, startAt: true, endAt: true, status: true, userId: true, user: { select: { name: true, email: true } } },
  });
  return rows
    .map((r): BusyBlock => {
      const notReturned = r.status === "OVERDUE" || (r.status === "ISSUED" && r.endAt.getTime() < now);
      return {
        start: r.startAt.getTime(),
        end: notReturned ? Math.max(to.getTime(), r.endAt.getTime()) : r.endAt.getTime(),
        kind: r.userId === viewerId ? "mine" : r.status === "BOOKED" ? "booked" : "active",
        reservationId: r.id,
        ownerName: r.user.name,
        ownerEmail: r.user.email,
      };
    })
    .filter((b) => b.start < to.getTime() && b.end > from.getTime())
    .sort((a, b) => a.start - b.start);
}

export async function equipmentDay(
  equipmentId: string,
  library: Pick<Library, "id" | "openMinute" | "closeMinute" | "workDays">,
  day: string,
  viewerId?: string | null,
  opts: { unavailable?: boolean } = {},
): Promise<RoomDay> {
  const rules = await getRules();
  const closed = await closedDaysFor(library.id);
  const open = zoned(day, library.openMinute).getTime();
  const close = zoned(day, library.closeMinute).getTime();
  const blocks = await equipmentBlocks(db, equipmentId, new Date(open), new Date(close), viewerId);
  const window = opts.unavailable ? null : dayWindow(day, library, new Date(), closed);
  const free = window ? subtractIntervals([window], blocks) : [];
  return { window, open, close, blocks, free, starts: startOptions(free, rules.slotStepMinutes, rules.minDurationMinutes) };
}
