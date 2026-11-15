/**
 * Vaxt köməkçiləri. Bütün vaxtlar bazada UTC saxlanılır, istifadəçiyə isə
 * Bakı vaxtı (Asia/Baku) ilə göstərilir. "Gün açarı" = Bakı vaxtı ilə YYYY-MM-DD.
 */

export const TZ = "Asia/Baku";
export const MINUTE = 60_000;

const dtfParts = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function parts(date: Date) {
  const p: Record<string, string> = {};
  for (const x of dtfParts.formatToParts(date)) p[x.type] = x.value;
  return {
    y: Number(p.year),
    m: Number(p.month),
    d: Number(p.day),
    h: Number(p.hour) % 24,
    min: Number(p.minute),
    s: Number(p.second),
  };
}

/** Verilmiş anda TZ-in UTC-dən fərqi (dəqiqə). */
export function tzOffsetMinutes(date: Date): number {
  const p = parts(date);
  const asUtc = Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / MINUTE);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Bakı vaxtı ilə gün açarı (YYYY-MM-DD). */
export function dayKey(date: Date): string {
  const p = parts(date);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

/** Bakı vaxtı ilə gecə yarısından keçən dəqiqələr. */
export function minutesOfDay(date: Date): number {
  const p = parts(date);
  return p.h * 60 + p.min;
}

/** Gün açarı + dəqiqə (Bakı vaxtı) → UTC Date. */
export function zoned(day: string, minutes: number): Date {
  const [y, m, d] = day.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 0, minutes);
  const off = tzOffsetMinutes(new Date(guess));
  const result = new Date(guess - off * MINUTE);
  // DST keçidləri üçün ikinci düzəliş (Bakıda DST yoxdur, amma ehtiyat üçün)
  const off2 = tzOffsetMinutes(result);
  return off2 === off ? result : new Date(guess - off2 * MINUTE);
}

export function isValidDayKey(s: string | undefined | null): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** ISO həftə günü: 1 = Bazar ertəsi … 7 = Bazar. */
export function isoWeekday(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  const wd = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return wd === 0 ? 7 : wd;
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

export function hhmm(minutes: number): string {
  return `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
}

export function parseHHMM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** "14:30" (Bakı vaxtı) */
export function fmtTime(date: Date): string {
  return hhmm(minutesOfDay(date));
}

export const MONTHS = [
  "yanvar", "fevral", "mart", "aprel", "may", "iyun",
  "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr",
];
export const WEEKDAYS = [
  "Bazar ertəsi", "Çərşənbə axşamı", "Çərşənbə", "Cümə axşamı", "Cümə", "Şənbə", "Bazar",
];
export const WEEKDAYS_SHORT = ["B.e.", "Ç.a.", "Çər.", "C.a.", "Cümə", "Şən.", "Baz."];

/** "17 noyabr, Bazar ertəsi" */
export function fmtDay(day: string, opts: { weekday?: boolean; year?: boolean } = {}): string {
  const [y, m, d] = day.split("-").map(Number);
  let s = `${d} ${MONTHS[m - 1]}`;
  if (opts.year) s += ` ${y}`;
  if (opts.weekday !== false) s += `, ${WEEKDAYS[isoWeekday(day) - 1]}`;
  return s;
}

/** "17 noyabr, 14:30" */
export function fmtDateTime(date: Date): string {
  return `${fmtDay(dayKey(date), { weekday: false })}, ${fmtTime(date)}`;
}

/** "14:30 – 15:30" */
export function fmtRange(start: Date, end: Date): string {
  return `${fmtTime(start)} – ${fmtTime(end)}`;
}

/** Dəqiqəni insan dilində: 90 → "1 saat 30 dəq" */
export function fmtDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h && m) return `${h} saat ${m} dəq`;
  if (h) return `${h} saat`;
  return `${m} dəq`;
}

export function diffMinutes(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / MINUTE);
}

export function addMinutes(d: Date, n: number): Date {
  return new Date(d.getTime() + n * MINUTE);
}

/** Nisbi vaxt: "5 dəq əvvəl", "2 saat sonra" */
export function fmtRelative(date: Date, now = new Date()): string {
  const diff = Math.round((date.getTime() - now.getTime()) / MINUTE);
  const abs = Math.abs(diff);
  const unit = abs < 60 ? `${abs} dəq` : abs < 1440 ? `${Math.round(abs / 60)} saat` : `${Math.round(abs / 1440)} gün`;
  if (abs < 1) return "indicə";
  return diff < 0 ? `${unit} əvvəl` : `${unit} sonra`;
}
