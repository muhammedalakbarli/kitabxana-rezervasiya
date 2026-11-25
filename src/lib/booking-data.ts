/** Rezervasiya ekranları üçün məlumat (API və server səhifələri paylaşır) */
import { db } from "./db";
import { closedDaysFor, equipmentDay, roomDay } from "./availability";
import { bookableDays, equipmentExtensionLimit, roomHours } from "./rules";
import { getRules } from "./settings";
import { maxMinutesForType } from "./equipment";
import { isValidDayKey } from "./time";

export async function roomAvailability(slug: string, dayParam: string | null, viewerId: string) {
  const lib = await db.library.findFirst({ where: { slug, isActive: true, archivedAt: null } });
  if (!lib) return null;
  const rules = await getRules();
  const closed = await closedDaysFor(lib.id);
  const hours = roomHours(lib);
  const days = bookableDays(new Date(), hours, rules.maxAdvanceDays, closed);
  const day = dayParam && isValidDayKey(dayParam) && days.includes(dayParam) ? dayParam : days[0] ?? null;
  const rooms = await db.room.findMany({
    where: { libraryId: lib.id, isActive: true, archivedAt: null },
    orderBy: { sortOrder: "asc" },
    include: { photos: { orderBy: { sortOrder: "asc" }, take: 3 } },
  });
  const roomData = day
    ? await Promise.all(
        rooms.map(async (r) => {
          const d = await roomDay(r.id, lib, day, viewerId, { unavailable: r.underMaintenance });
          return {
            id: r.id, slug: r.slug, name: r.name, code: r.code, capacity: r.capacity,
            photos: r.photos.map((p) => p.url), features: r.features.split("\n").map((s) => s.trim()).filter(Boolean),
            maintenance: r.underMaintenance, maintenanceNote: r.maintenanceNote,
            open: d.open, close: d.close, blocks: d.blocks.map(({ start, end, kind }) => ({ start, end, kind })), free: d.free, starts: d.starts,
          };
        }),
      )
    : [];
  return {
    library: { id: lib.id, slug: lib.slug, name: lib.name, shortName: lib.shortName, openMinute: hours.openMinute, closeMinute: hours.closeMinute },
    days,
    day,
    rooms: roomData,
    rules: {
      maxByCategory: { 1: rules.soloMaxMinutes, 2: rules.duoMaxMinutes, 3: rules.trioMaxMinutes, 4: rules.groupMaxMinutes },
      step: rules.slotStepMinutes, minDuration: rules.minDurationMinutes, checkInAfter: rules.checkInAfterMinutes,
      waitlistHold: rules.waitlistHoldMinutes, recommendedLead: rules.recommendedLeadMinutes,
    },
  };
}
export type RoomAvailability = NonNullable<Awaited<ReturnType<typeof roomAvailability>>>;

export async function equipmentAvailability(slug: string, dayParam: string | null, type: "LAPTOP" | "ADAPTER", viewerId: string) {
  const lib = await db.library.findFirst({ where: { slug, isActive: true, archivedAt: null } });
  if (!lib) return null;
  const rules = await getRules();
  const closed = await closedDaysFor(lib.id);
  const days = bookableDays(new Date(), lib, rules.maxAdvanceDays, closed);
  const day = dayParam && isValidDayKey(dayParam) && days.includes(dayParam) ? dayParam : days[0] ?? null;
  const items = await db.equipment.findMany({ where: { libraryId: lib.id, type, isActive: true, archivedAt: null }, orderBy: { sortOrder: "asc" } });
  const data = day
    ? await Promise.all(
        items.map(async (e) => {
          const d = await equipmentDay(e.id, lib, day, viewerId, { unavailable: e.underMaintenance });
          return {
            id: e.id, tag: e.assetTag, name: e.name, photo: e.photoUrl, description: e.description,
            maintenance: e.underMaintenance, open: d.open, close: d.close,
            blocks: d.blocks.map(({ start, end, kind }) => ({ start, end, kind })), starts: d.starts,
          };
        }),
      )
    : [];
  const max = maxMinutesForType(type, rules);
  return {
    library: { id: lib.id, slug: lib.slug, name: lib.name, shortName: lib.shortName },
    days, day, type, items: data,
    rules: { max, extension: equipmentExtensionLimit(max, rules.equipmentExtensionPercent), step: rules.slotStepMinutes, minDuration: rules.minDurationMinutes, pickupGrace: rules.equipmentPickupGraceMinutes },
  };
}
export type EquipmentAvailability = NonNullable<Awaited<ReturnType<typeof equipmentAvailability>>>;
