"use client";

/**
 * Hesabat qrafikləri — tək seriyalı (legend lazım deyil, başlıq nəyi göstərdiyini deyir).
 * Rəng: brend yaşılı (#44766C); böyüklük xəritəsi — eyni çaların açıqdan tünd pillələri.
 * Sapmalar ≤24px, 4px yuvarlaq uc, 2px boşluq; hover tooltip + cədvəl görünüşü.
 */
import { useState, type ReactNode } from "react";
import { Table2 } from "lucide-react";
import { cx } from "./ui";

const SERIES = "#44766c";
const RAMP = ["#eef4f2", "#d3e8bf", "#a9cdb9", "#7fae9f", "#44766c", "#16423c"]; // 0 → 100%

function Tooltip({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <div className="pointer-events-none fixed z-50 -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-xl bg-brand-900 px-3 py-2 text-xs whitespace-nowrap text-white shadow-lift" style={{ left: x, top: y }}>
      {children}
    </div>
  );
}

function TableView({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-3 text-sm">
      <summary className="inline-flex cursor-pointer items-center gap-1.5 text-xs font-semibold text-brand-600"><Table2 className="size-3.5" /> Cədvəl kimi göstər</summary>
      <div className="mt-2 max-h-72 overflow-auto rounded-xl ring-1 ring-brand-100">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-brand-50 text-left text-brand-900/60"><tr>{head.map((h) => <th key={h} className="px-3 py-2 font-semibold">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-brand-100">{rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className="px-3 py-1.5 tabular-nums text-brand-900">{c}</td>)}</tr>)}</tbody>
        </table>
      </div>
    </details>
  );
}

const niceMax = (v: number) => {
  if (v <= 5) return 5;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
};

/** Zamana görə sütunlar (məs. günlük istifadə) */
export function ColumnChart({ data, valueLabel, unit = "" }: { data: { key: string; label: string; short: string; value: number; extra?: string }[]; valueLabel: string; unit?: string }) {
  const [tip, setTip] = useState<{ x: number; y: number; i: number } | null>(null);
  const max = niceMax(Math.max(1, ...data.map((d) => d.value)));
  const every = Math.max(1, Math.ceil(data.length / 7));
  const peak = data.reduce((m, d, i) => (d.value > (data[m]?.value ?? -1) ? i : m), 0);
  return (
    <div>
      <div className="relative h-52 pl-9">
        {[0, 0.5, 1].map((f) => (
          <div key={f} className="absolute right-0 left-9 border-t border-brand-100" style={{ bottom: `${f * 100}%` }}>
            <span className="absolute -top-2 -left-9 w-7 text-right text-[10px] text-brand-900/45 tabular-nums">{Math.round(max * f)}</span>
          </div>
        ))}
        <div className="absolute inset-0 left-9 flex items-end gap-[2px]">
          {data.map((d, i) => (
            <div
              key={d.key}
              className="relative flex h-full flex-1 items-end justify-center"
              onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, i })}
              onMouseLeave={() => setTip(null)}
            >
              <div className="w-full max-w-6 rounded-t-[4px] transition-opacity" style={{ height: `${(d.value / max) * 100}%`, background: SERIES, opacity: tip && tip.i !== i ? 0.55 : 1, minHeight: d.value ? 2 : 0 }} />
              {i === peak && d.value > 0 && <span className="absolute text-[10px] font-semibold text-brand-900 tabular-nums" style={{ bottom: `calc(${(d.value / max) * 100}% + 2px)` }}>{d.value}</span>}
            </div>
          ))}
        </div>
      </div>
      <div className="relative mt-1 ml-9 h-4">
        {data.map((d, i) =>
          i % every === 0 ? (
            <span key={d.key} className="absolute -translate-x-1/2 text-[10px] whitespace-nowrap text-brand-900/45" style={{ left: `${((i + 0.5) / data.length) * 100}%` }}>{d.short}</span>
          ) : null,
        )}
      </div>
      {tip && data[tip.i] && <Tooltip x={tip.x} y={tip.y}><div className="font-semibold">{data[tip.i].label}</div><div>{valueLabel}: <b>{data[tip.i].value}{unit}</b></div>{data[tip.i].extra && <div className="text-white/75">{data[tip.i].extra}</div>}</Tooltip>}
      <TableView head={["Tarix", valueLabel, ...(data.some((d) => d.extra) ? ["Əlavə"] : [])]} rows={data.map((d) => [d.label, d.value, ...(data.some((x) => x.extra) ? [d.extra ?? ""] : [])])} />
    </div>
  );
}

/** Üfüqi zolaqlar — sıralanmış siyahı (fakültə, kurs, otaq) */
export function BarList({ rows, valueLabel, unit = "", maxValue, sub }: {
  rows: { key: string; label: string; value: number; note?: string }[]; valueLabel: string; unit?: string; maxValue?: number; sub?: string;
}) {
  const format = (v: number) => `${v}${unit}`;
  const [tip, setTip] = useState<{ x: number; y: number; i: number } | null>(null);
  const max = maxValue ?? Math.max(1, ...rows.map((r) => r.value));
  if (!rows.length) return <p className="py-6 text-center text-sm text-brand-900/50">Bu dövr üçün məlumat yoxdur.</p>;
  return (
    <div>
      {sub && <p className="mb-3 text-xs text-brand-900/55">{sub}</p>}
      <ul className="space-y-2.5">
        {rows.map((r, i) => (
          <li key={r.key} onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, i })} onMouseLeave={() => setTip(null)}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="truncate text-brand-900">{r.label}</span>
              <span className="shrink-0 font-semibold text-brand-900 tabular-nums">{format(r.value)}</span>
            </div>
            <div className="h-2.5 rounded-full bg-brand-50">
              <div className="h-full rounded-full transition-opacity" style={{ width: `${Math.max(r.value ? 1.5 : 0, (r.value / max) * 100)}%`, background: SERIES, opacity: tip && tip.i !== i ? 0.55 : 1 }} />
            </div>
          </li>
        ))}
      </ul>
      {tip && rows[tip.i] && <Tooltip x={tip.x} y={tip.y}><div className="font-semibold">{rows[tip.i].label}</div><div>{valueLabel}: <b>{format(rows[tip.i].value)}</b></div>{rows[tip.i].note && <div className="text-white/75">{rows[tip.i].note}</div>}</Tooltip>}
      <TableView head={["Ad", valueLabel, "Qeyd"]} rows={rows.map((r) => [r.label, format(r.value), r.note ?? ""])} />
    </div>
  );
}

const WD = ["B.e.", "Ç.a.", "Çər.", "C.a.", "Cümə", "Şən.", "Baz."];

/** Həftə günü × saat üzrə doluluq faizi */
export function Heatmap({ hours, rows }: { hours: number[]; rows: { weekday: number; values: number[] }[] }) {
  const [tip, setTip] = useState<{ x: number; y: number; r: number; c: number } | null>(null);
  const color = (v: number) => RAMP[v <= 0 ? 0 : Math.min(RAMP.length - 1, 1 + Math.floor(v / 20))];
  if (!rows.length) return <p className="py-6 text-center text-sm text-brand-900/50">Bu dövr üçün məlumat yoxdur.</p>;
  return (
    <div>
      <div className="overflow-x-auto">
        <div className="inline-grid min-w-full gap-[2px]" style={{ gridTemplateColumns: `44px repeat(${hours.length}, minmax(28px, 1fr))` }}>
          <div />
          {hours.map((h) => <div key={h} className="pb-1 text-center text-[10px] text-brand-900/45 tabular-nums">{String(h).padStart(2, "0")}</div>)}
          {rows.map((row, ri) => (
            <div key={row.weekday} className="contents">
              <div className="flex items-center text-xs font-medium text-brand-900/70">{WD[row.weekday - 1]}</div>
              {row.values.map((v, ci) => (
                <div
                  key={ci}
                  className={cx("h-8 rounded-[4px] transition", tip && tip.r === ri && tip.c === ci && "ring-2 ring-brand-900")}
                  style={{ background: color(v) }}
                  onMouseMove={(e) => setTip({ x: e.clientX, y: e.clientY, r: ri, c: ci })}
                  onMouseLeave={() => setTip(null)}
                  aria-label={`${WD[row.weekday - 1]} ${hours[ci]}:00 — ${v}%`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2 text-[11px] text-brand-900/55">
        <span>0%</span>
        {RAMP.map((c) => <span key={c} className="h-2.5 w-6 rounded-sm" style={{ background: c }} />)}
        <span>100% doluluq</span>
      </div>
      {tip && <Tooltip x={tip.x} y={tip.y}><div className="font-semibold">{WD[rows[tip.r].weekday - 1]}, {String(hours[tip.c]).padStart(2, "0")}:00–{String(hours[tip.c] + 1).padStart(2, "0")}:00</div><div>Orta doluluq: <b>{rows[tip.r].values[tip.c]}%</b></div></Tooltip>}
      <TableView head={["Gün", ...hours.map((h) => `${h}:00`)]} rows={rows.map((r) => [WD[r.weekday - 1], ...r.values.map((v) => `${v}%`)])} />
    </div>
  );
}
