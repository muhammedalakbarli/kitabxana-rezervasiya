import { describe, expect, it } from "vitest";
import { DEFAULT_RULES } from "@/lib/rules-config";
import {
  bookableDays, categoryForCount, checkInWindow, dayWindow, effectiveEnd, endOptions,
  equipmentExtensionLimit, maxMinutesForCategory, requiredInvitees, startOptions, subtractIntervals,
} from "@/lib/rules";
import { MINUTE, dayKey, fmtTime, isoWeekday, zoned } from "@/lib/time";

const R = DEFAULT_RULES;
const HOURS = { openMinute: 540, closeMinute: 1080, workDays: "1,2,3,4,5" };
// 2026-11-16 Bazar ertəsidir
const MON = "2026-11-16";

describe("vaxt köməkçiləri (Asia/Baku, UTC+4)", () => {
  it("zoned → UTC", () => {
    expect(zoned(MON, 540).toISOString()).toBe("2026-11-16T05:00:00.000Z");
    expect(fmtTime(zoned(MON, 540))).toBe("09:00");
    expect(dayKey(new Date("2026-11-15T21:30:00Z"))).toBe("2026-11-16");
  });
  it("həftə günü", () => {
    expect(isoWeekday(MON)).toBe(1);
    expect(isoWeekday("2026-11-22")).toBe(7);
  });
});

describe("müddət qaydaları", () => {
  it("1/2/3/4+ nəfər → 1/2/3/4 saat", () => {
    expect(maxMinutesForCategory(1, R)).toBe(60);
    expect(maxMinutesForCategory(2, R)).toBe(120);
    expect(maxMinutesForCategory(3, R)).toBe(180);
    expect(maxMinutesForCategory(4, R)).toBe(240);
  });
  it("admin tək nəfər limitini 1.5 saata qaldıra bilər", () => {
    expect(maxMinutesForCategory(1, { ...R, soloMaxMinutes: 90 })).toBe(90);
  });
  it("təsdiqləyən say → kateqoriya", () => {
    expect(categoryForCount(0)).toBeNull();
    expect(categoryForCount(1)).toBe(1);
    expect(categoryForCount(3)).toBe(3);
    expect(categoryForCount(4)).toBe(4);
    expect(categoryForCount(8)).toBe(4);
  });
  it("dəvət sayı: 4+ üçün 3 nəfər kifayətdir", () => {
    expect(requiredInvitees(1)).toBe(0);
    expect(requiredInvitees(2)).toBe(1);
    expect(requiredInvitees(3)).toBe(2);
    expect(requiredInvitees(4)).toBe(3);
  });
});

describe("QR təsdiqindən sonra müddətin yenidən hesablanması", () => {
  const start = zoned(MON, 600).getTime(); // 10:00
  it("heç kim gəlməyib → gəlmədi", () => {
    expect(effectiveEnd(start, start + 120 * MINUTE, 0, R)).toBeNull();
  });
  it("2 nəfərlik 2 saatlıq rezervdə 1 nəfər skan edib → 1 saat", () => {
    expect(effectiveEnd(start, start + 120 * MINUTE, 1, R)).toBe(start + 60 * MINUTE);
  });
  it("hamı skan edib → planlaşdırılan müddət qalır", () => {
    expect(effectiveEnd(start, start + 120 * MINUTE, 2, R)).toBe(start + 120 * MINUTE);
  });
  it("4 nəfərlik 4 saatlıq rezervdə 3 nəfər → 3 saat", () => {
    expect(effectiveEnd(start, start + 240 * MINUTE, 3, R)).toBe(start + 180 * MINUTE);
  });
  it("pəncərə: başlanğıcdan 5 dəq əvvəl / 5 dəq sonra", () => {
    const w = checkInWindow(start, R);
    expect(w.start).toBe(start - 5 * MINUTE);
    expect(w.end).toBe(start + 5 * MINUTE);
  });
});

describe("boş vaxtların hesablanması", () => {
  it("iş saatları 09:00–18:00, keçmiş vaxt kəsilir", () => {
    const now = zoned(MON, 13 * 60 + 7); // 13:07
    const w = dayWindow(MON, HOURS, now)!;
    expect(fmtTime(new Date(w.start))).toBe("13:07");
    expect(fmtTime(new Date(w.end))).toBe("18:00");
  });
  it("həftə sonu bağlıdır", () => {
    expect(dayWindow("2026-11-21", HOURS, zoned(MON, 0))).toBeNull();
  });
  it("bayram günü bağlıdır", () => {
    expect(dayWindow(MON, HOURS, zoned(MON, 0), [MON])).toBeNull();
  });
  it("məşğul intervallar çıxılır", () => {
    const base = [{ start: 0, end: 100 }];
    expect(subtractIntervals(base, [{ start: 10, end: 20 }, { start: 15, end: 30 }, { start: 90, end: 120 }]))
      .toEqual([{ start: 0, end: 10 }, { start: 30, end: 90 }]);
  });
  it("başlanğıc variantları: 'indi' + 15 dəqiqəlik şəbəkə", () => {
    const s = zoned(MON, 10 * 60 + 7).getTime();
    const e = zoned(MON, 11 * 60).getTime();
    const opts = startOptions([{ start: s, end: e }], 15, 15).map((o) => fmtTime(new Date(o.start)));
    expect(opts).toEqual(["10:07", "10:15", "10:30", "10:45"]);
  });
  it("bitmə variantları növbəti rezervə və limitə görə məhdudlaşır", () => {
    const s = zoned(MON, 10 * 60 + 7).getTime();
    const maxEnd = zoned(MON, 11 * 60).getTime();
    const ends = endOptions(s, maxEnd, 60, 15, 15).map((x) => fmtTime(new Date(x)));
    expect(ends).toEqual(["10:30", "10:45", "11:00"]);
  });
  it("saat 17:00-da noutbuk maksimum 18:00-a qədər", () => {
    const s = zoned(MON, 17 * 60).getTime();
    const close = zoned(MON, 18 * 60).getTime();
    const ends = endOptions(s, close, 180, 15, 15);
    expect(fmtTime(new Date(ends[ends.length - 1]))).toBe("18:00");
  });
  it("rezerv günləri yalnız iş günləridir", () => {
    const days = bookableDays(zoned("2026-11-20", 600), HOURS, 7); // Cümə
    expect(days).toEqual(["2026-11-20", "2026-11-23", "2026-11-24", "2026-11-25", "2026-11-26", "2026-11-27"]);
  });
});

describe("avadanlıq", () => {
  it("3 saatlıq noutbuk bir dəfə maksimum 1 saat 30 dəq uzadılır", () => {
    expect(equipmentExtensionLimit(180, 50)).toBe(90);
  });
});
