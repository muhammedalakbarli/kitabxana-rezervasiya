import Link from "next/link";
import { cx } from "./ui";

export function LibraryTabs({ libraries, current, base }: { libraries: { id: string; shortName: string }[]; current: string; base: string }) {
  return (
    <div className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="inline-flex gap-1 rounded-2xl bg-white p-1 shadow-card ring-1 ring-brand-100">
        {libraries.map((l) => (
          <Link key={l.id} href={`${base}?k=${l.id}`} className={cx("rounded-xl px-4 py-2 text-sm font-semibold whitespace-nowrap", l.id === current ? "bg-brand-500 text-white" : "text-brand-800 hover:bg-brand-50")}>{l.shortName}</Link>
        ))}
      </div>
    </div>
  );
}
