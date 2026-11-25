import { addDays, dayKey, isValidDayKey } from "./time";

export const PRESETS = [
  { key: "bugun", label: "Bu gün", days: 1 },
  { key: "7", label: "Son 7 gün", days: 7 },
  { key: "30", label: "Son 30 gün", days: 30 },
  { key: "ay", label: "Bu ay", days: 0 },
  { key: "90", label: "Son 3 ay", days: 90 },
  { key: "365", label: "Son 1 il", days: 365 },
] as const;

/** Hesabat aralığını yoxla: saxlama müddəti daxilində, ən çox 366 gün */
export function resolveRange(sp: { from?: string | null; to?: string | null; p?: string | null }, retentionDays: number) {
  const today = dayKey(new Date());
  const minDay = addDays(today, -retentionDays);
  let from: string;
  let to = today;
  const preset = PRESETS.find((p) => p.key === sp.p);
  if (preset) {
    from = preset.key === "ay" ? `${today.slice(0, 8)}01` : addDays(today, -(preset.days - 1));
  } else if (isValidDayKey(sp.from) && isValidDayKey(sp.to)) {
    from = sp.from!;
    to = sp.to!;
  } else {
    from = addDays(today, -29);
  }
  if (from > to) [from, to] = [to, from];
  if (from < minDay) from = minDay;
  if (to > addDays(today, 60)) to = addDays(today, 60);
  return { from, to, preset: preset?.key ?? (sp.from ? "custom" : "30"), minDay, today };
}
