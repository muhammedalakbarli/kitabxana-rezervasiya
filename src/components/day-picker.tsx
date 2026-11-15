import Link from "next/link";
import { MONTHS, WEEKDAYS_SHORT, dayKey, isoWeekday } from "@/lib/time";
import { cx } from "./ui";

export function DayPicker({ days, selected, hrefFor }: { days: string[]; selected: string; hrefFor: (day: string) => string }) {
  const today = dayKey(new Date());
  if (!days.length) return null;
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0">
      <div className="flex gap-2">
        {days.map((d) => {
          const [, m, dd] = d.split("-").map(Number);
          const active = d === selected;
          return (
            <Link
              key={d}
              href={hrefFor(d)}
              scroll={false}
              aria-current={active ? "date" : undefined}
              className={cx(
                "flex min-w-[68px] shrink-0 flex-col items-center rounded-2xl border px-3 py-2 transition",
                active ? "border-brand-500 bg-brand-500 text-white shadow-md" : "border-brand-100 bg-white text-brand-900 hover:border-brand-300",
              )}
            >
              <span className={cx("text-[11px] font-medium", active ? "text-white/80" : "text-brand-900/55")}>{d === today ? "Bu gün" : WEEKDAYS_SHORT[isoWeekday(d) - 1]}</span>
              <span className="text-lg leading-tight font-semibold">{dd}</span>
              <span className={cx("text-[11px]", active ? "text-white/80" : "text-brand-900/55")}>{MONTHS[m - 1].slice(0, 3)}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
