import { db } from "./db";

/** İstifadəçinin otaq rezervasiyaları (sahib və ya rədd etməmiş iştirakçı kimi) */
export async function userRoomReservations(userId: string, scope: "upcoming" | "past", take = 30) {
  const now = new Date();
  return db.reservation.findMany({
    where: {
      participants: { some: { userId, inviteStatus: { not: "DECLINED" } } },
      ...(scope === "upcoming"
        ? { status: { in: ["BOOKED", "ACTIVE"] }, endAt: { gt: now } }
        : { OR: [{ status: { in: ["COMPLETED", "CANCELLED", "NO_SHOW"] } }, { endAt: { lte: now } }] }),
    },
    include: {
      room: { include: { library: true, photos: { take: 1, orderBy: { sortOrder: "asc" } } } },
      participants: { include: { user: { select: { id: true, name: true, email: true } } } },
      owner: { select: { id: true, name: true, email: true } },
    },
    orderBy: { startAt: scope === "upcoming" ? "asc" : "desc" },
    take,
  });
}

export async function userEquipmentReservations(userId: string, scope: "upcoming" | "past", take = 30) {
  return db.equipmentReservation.findMany({
    where: {
      userId,
      ...(scope === "upcoming" ? { status: { in: ["BOOKED", "ISSUED", "OVERDUE"] } } : { status: { in: ["RETURNED", "CANCELLED", "NO_SHOW"] } }),
    },
    include: { equipment: { include: { library: true } } },
    orderBy: { startAt: scope === "upcoming" ? "asc" : "desc" },
    take,
  });
}

export async function userWaitlist(userId: string) {
  return db.waitlistEntry.findMany({
    where: { userId, status: { in: ["WAITING", "NOTIFIED"] } },
    include: { library: true, room: true, holdRoom: true },
    orderBy: { startAt: "asc" },
  });
}

export type RoomReservationListItem = Awaited<ReturnType<typeof userRoomReservations>>[number];
