import type { BusyBlock } from "@/lib/availability";
import { fmtTime, minutesOfDay } from "@/lib/time";
import { cx } from "./ui";

/**
 * Günün vaxt zolağı: iş saatları üzrə məşğul / boş / mənim / keçmiş blokları.
 * Server komponentidir — interaktiv seçim rezerv formasındadır.
 */
export function DayTimeline({
  open, close, blocks, now = Date.now(), showOwners = false, compact = false, hrefForFree,
}: {
  open: number; close: number; blocks: BusyBlock[]; now?: number; showOwners?: boolean; compact?: boolean; hrefForFree?: string;
}) {
  const span = close - open;
  const pct = (t: number) => `${(((Math.min(Math.max(t, open), close) - open) / span) * 100).toFixed(3)}%`;
  const width = (a: number, b: number) => `${(((Math.min(b, close) - Math.max(a, open)) / span) * 100).toFixed(3)}%`;
  const hours: number[] = [];
  const startMin = minutesOfDay(new Date(open));
  const firstHour = open + ((60 - (startMin % 60)) % 60) * 60_000;
  for (let t = firstHour; t <= close; t += 3600_000) hours.push(t);
  const pastEnd = Math.min(now, close);

  const tone: Record<BusyBlock["kind"], string> = {
    booked: "bg-brand-300/70 text-brand-900",
    active: "bg-brand-700 text-white",
    mine: "bg-brand-500 text-white ring-2 ring-cream",
    hold: "bg-cream text-brand-900 stripes",
    "hold-mine": "bg-cream text-brand-900 ring-2 ring-brand-500",
  };
  const label: Record<BusyBlock["kind"], string> = {
    booked: "Rezerv olunub", active: "İstifadədə", mine: "Sizin", hold: "Növbə üçün saxlanılır", "hold-mine": "Sizin üçün saxlanılır",
  };

  return (
    <div className={compact ? "" : "pt-1"}>
      <div className={cx("relative overflow-hidden rounded-xl bg-mint/70 ring-1 ring-inset ring-brand-100", compact ? "h-7" : "h-11")}>
        {now > open && <div className="absolute inset-y-0 left-0 bg-brand-900/[0.07] stripes" style={{ width: pct(pastEnd) }} title="Keçmiş vaxt" />}
        {hours.map((h) => (
          <div key={h} className="absolute inset-y-0 w-px bg-white/80" style={{ left: pct(h) }} />
        ))}
        {blocks.map((b, i) => (
          <div
            key={i}
            className={cx("absolute inset-y-1 flex items-center overflow-hidden rounded-lg px-1.5 text-[11px] font-semibold whitespace-nowrap", tone[b.kind])}
            style={{ left: pct(b.start), width: width(b.start, b.end) }}
            title={`${label[b.kind]}: ${fmtTime(new Date(b.start))}–${fmtTime(new Date(b.end))}${showOwners && b.ownerEmail ? ` · ${b.ownerName ?? b.ownerEmail}` : ""}`}
          >
            {!compact && <span className="truncate">{showOwners && b.ownerName ? b.ownerName : `${fmtTime(new Date(b.start))}–${fmtTime(new Date(b.end))}`}</span>}
          </div>
        ))}
        {now > open && now < close && <div className="absolute inset-y-0 w-0.5 bg-danger" style={{ left: pct(now) }} title="İndi" />}
        {hrefForFree && <a href={hrefForFree} className="absolute inset-0" aria-label="Rezerv et" />}
      </div>
      {!compact && (
        <div className="relative mt-1 h-4 text-[10px] font-medium text-brand-900/45">
          {hours.map((h, i) => (
            <span key={h} className={cx("absolute -translate-x-1/2", i === 0 && "translate-x-0", h === close && "-translate-x-full", i % 2 === 1 && "hidden sm:inline")} style={{ left: pct(h) }}>
              {fmtTime(new Date(h))}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function TimelineLegend({ withHold = true }: { withHold?: boolean }) {
  const items = [
    ["bg-mint ring-1 ring-brand-200", "Boş"],
    ["bg-brand-300/70", "Rezerv olunub"],
    ["bg-brand-700", "İstifadədə"],
    ["bg-brand-500 ring-2 ring-cream", "Sizin"],
    ...(withHold ? [["bg-cream stripes", "Növbə üçün saxlanılır"]] : []),
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-brand-900/65">
      {items.map(([c, l]) => (
        <span key={l} className="inline-flex items-center gap-1.5"><span className={cx("size-3 rounded", c)} />{l}</span>
      ))}
    </div>
  );
}
