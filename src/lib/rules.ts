/**
 * Rezervasiya qaydalarının "təmiz" (DB-dən asılı olmayan) məntiqi.
 * Bütün funksiyalar unit testlərlə yoxlanılır (tests/rules.test.ts).
 */
import { GROUP_MIN_MEMBERS, type PartyCategory, type Rules } from "./rules-config";
import { MINUTE, addDays, isoWeekday, minutesOfDay, zoned, dayKey } from "./time";

export type Interval = { start: number; end: number };

export function maxMinutesForCategory(cat: PartyCategory, r: Rules): number {
  switch (cat) {
    case 1: return r.soloMaxMinutes;
    case 2: return r.duoMaxMinutes;
    case 3: return r.trioMaxMinutes;
    case 4: return r.groupMaxMinutes;
  }
}

/** QR ilə təsdiqləyən nəfər sayına görə kateqoriya (0 → null). */
export function categoryForCount(n: number): PartyCategory | null {
  if (n <= 0) return null;
  if (n >= GROUP_MIN_MEMBERS) return 4;
  return n as PartyCategory;
}

/** Kateqoriya üçün sahibdən əlavə dəvət olunmalı nəfər sayı (4+ üçün 3 nəfər kifayətdir). */
export function requiredInvitees(cat: PartyCategory): number {
  return Math.min(cat, GROUP_MIN_MEMBERS) - 1;
}

export function mergeIntervals(list: Interval[]): Interval[] {
  const sorted = list.filter((i) => i.end > i.start).sort((a, b) => a.start - b.start);
  const out: Interval[] = [];
  for (const i of sorted) {
    const last = out[out.length - 1];
    if (last && i.start <= last.end) last.end = Math.max(last.end, i.end);
    else out.push({ ...i });
  }
  return out;
}

/** base intervallarından busy intervallarını çıxır. */
export function subtractIntervals(base: Interval[], busy: Interval[]): Interval[] {
  const b = mergeIntervals(busy);
  const out: Interval[] = [];
  for (const iv of mergeIntervals(base)) {
    let cursor = iv.start;
    for (const x of b) {
      if (x.end <= cursor) continue;
      if (x.start >= iv.end) break;
      if (x.start > cursor) out.push({ start: cursor, end: Math.min(x.start, iv.end) });
      cursor = Math.max(cursor, x.end);
      if (cursor >= iv.end) break;
    }
    if (cursor < iv.end) out.push({ start: cursor, end: iv.end });
  }
  return out;
}

export function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

export type Hours = { openMinute: number; closeMinute: number; workDays: string };

export function parseWorkDays(s: string): number[] {
  return s.split(",").map((x) => Number(x.trim())).filter((n) => n >= 1 && n <= 7);
}

export function isWorkDay(day: string, hours: Hours, closedDays: string[] = []): boolean {
  return parseWorkDays(hours.workDays).includes(isoWeekday(day)) && !closedDays.includes(day);
}

/**
 * Günün rezerv oluna bilən pəncərəsi (iş saatları, keçmiş vaxt kəsilir).
 * Bağlı gündə və ya artıq bitmiş gündə null qaytarır.
 */
export function dayWindow(day: string, hours: Hours, now: Date, closedDays: string[] = []): Interval | null {
  if (!isWorkDay(day, hours, closedDays)) return null;
  const open = zoned(day, hours.openMinute).getTime();
  const close = zoned(day, hours.closeMinute).getTime();
  // indiki dəqiqəyə yuvarlaqlaşdır (yuxarı)
  const nowMs = Math.ceil(now.getTime() / MINUTE) * MINUTE;
  const start = Math.max(open, nowMs);
  if (start >= close) return null;
  return { start, end: close };
}

export type StartOption = { start: number; maxEnd: number };

/**
 * Boş intervallardan başlanğıc variantları: şəbəkə nöqtələri (məs. hər 15 dəq) +
 * boş intervalın özünün başlanğıcı (məs. "indi" və ya əvvəlki rezervin bitdiyi an).
 */
export function startOptions(free: Interval[], stepMinutes: number, minDurationMinutes: number): StartOption[] {
  const step = stepMinutes * MINUTE;
  const minDur = minDurationMinutes * MINUTE;
  const out: StartOption[] = [];
  for (const iv of free) {
    if (iv.end - iv.start < minDur) continue;
    const seen = new Set<number>();
    const push = (s: number) => {
      if (s < iv.start || iv.end - s < minDur || seen.has(s)) return;
      seen.add(s);
      out.push({ start: s, maxEnd: iv.end });
    };
    push(iv.start);
    // Bakı vaxtına görə şəbəkə: günün dəqiqəsi step-ə bölünən nöqtələr
    const startLocal = minutesOfDay(new Date(iv.start));
    const firstAligned = iv.start + ((stepMinutes - (startLocal % stepMinutes)) % stepMinutes) * MINUTE;
    // saniyələri sıfırla
    const aligned = Math.floor(firstAligned / MINUTE) * MINUTE;
    for (let s = aligned; s < iv.end; s += step) push(s);
  }
  return out.sort((a, b) => a.start - b.start);
}

/**
 * Seçilmiş başlanğıc üçün bitmə variantları: şəbəkə nöqtələri + limitin özü
 * (məs. "indi" 10:07-dən başlayan və 11:00-da növbəti rezervə qədər olan hal).
 */
export function endOptions(start: number, maxEnd: number, maxMinutes: number, stepMinutes: number, minDurationMinutes: number): number[] {
  const limit = Math.min(maxEnd, start + maxMinutes * MINUTE);
  const minEnd = start + minDurationMinutes * MINUTE;
  const out = new Set<number>();
  const startLocal = minutesOfDay(new Date(start));
  let e = start + (stepMinutes - (startLocal % stepMinutes)) * MINUTE;
  e = Math.floor(e / MINUTE) * MINUTE;
  for (; e <= limit; e += stepMinutes * MINUTE) if (e >= minEnd) out.add(e);
  if (limit >= minEnd) out.add(limit);
  return [...out].sort((a, b) => a - b);
}

/**
 * QR pəncərəsi bağlandıqdan sonra rezervasiyanın yeni bitmə vaxtı.
 * - Heç kim təsdiqləməyibsə → null (gəlmədi).
 * - Məs. 2 nəfərlik 2 saatlıq rezervdə yalnız 1 nəfər skan edibsə → 1 saata qısalır.
 */
export function effectiveEnd(startMs: number, plannedEndMs: number, checkedInCount: number, r: Rules): number | null {
  const cat = categoryForCount(checkedInCount);
  if (!cat) return null;
  return Math.min(plannedEndMs, startMs + maxMinutesForCategory(cat, r) * MINUTE);
}

/** QR təsdiq pəncərəsi */
export function checkInWindow(startMs: number, r: Rules): Interval {
  return { start: startMs - r.checkInBeforeMinutes * MINUTE, end: startMs + r.checkInAfterMinutes * MINUTE };
}

/** Avadanlıq uzatma limiti: ilkin müddətin faizi (standart 50%). */
export function equipmentExtensionLimit(originalMinutes: number, percent: number): number {
  return Math.floor((originalMinutes * percent) / 100);
}

/** Bugündən başlayaraq rezerv oluna bilən iş günləri. */
export function bookableDays(now: Date, hours: Hours, maxAdvanceDays: number, closedDays: string[] = []): string[] {
  const today = dayKey(now);
  const out: string[] = [];
  for (let i = 0; i <= maxAdvanceDays; i++) {
    const day = addDays(today, i);
    if (dayWindow(day, hours, now, closedDays) !== null) out.push(day);
  }
  return out;
}
