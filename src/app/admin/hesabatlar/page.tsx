import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3, CalendarRange, Clock3, Download, FileSpreadsheet, Gauge, Laptop, Timer, Users, UserX } from "lucide-react";
import { BarList, ColumnChart, Heatmap } from "@/components/charts";
import { Badge, Card, PageHeader, SectionTitle, Stat, btn, cx } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { buildReport, COURSE_LABEL } from "@/lib/analytics";
import { db } from "@/lib/db";
import { PRESETS, resolveRange } from "@/lib/report-range";
import { getRules } from "@/lib/settings";
import { MONTHS, fmtDay } from "@/lib/time";

export const metadata: Metadata = { title: "Hesabatlar və analitika" };

type SP = { from?: string; to?: string; p?: string; k?: string };

export default async function ReportsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const ctx = await requireStaff();
  const sp = await searchParams;
  const rules = await getRules();
  const range = resolveRange(sp, rules.retentionDays);
  const libraries = ctx.superAdmin ? await db.library.findMany({ where: { archivedAt: null }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }) : [];
  const libraryId = ctx.libraryId ?? (ctx.superAdmin && sp.k && libraries.some((l) => l.id === sp.k) ? sp.k : null);
  const r = await buildReport({ from: range.from, to: range.to, libraryId });
  const s = r.summary;

  const q = (extra: Record<string, string>) => {
    const base: Record<string, string> = range.preset === "custom" ? { from: range.from, to: range.to } : { p: range.preset };
    if (ctx.superAdmin && sp.k) base.k = sp.k;
    return new URLSearchParams({ ...base, ...extra }).toString();
  };
  const exportQs = (format: string, dataset?: string) => new URLSearchParams({ from: range.from, to: range.to, format, ...(dataset ? { dataset } : {}), ...(libraryId && ctx.superAdmin ? { k: libraryId } : {}) }).toString();
  const shortDay = (d: string) => `${Number(d.slice(8))} ${MONTHS[Number(d.slice(5, 7)) - 1].slice(0, 3)}`;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={r.libraryName}
        title="Hesabatlar və analitika"
        subtitle={`${fmtDay(range.from, { weekday: false, year: true })} — ${fmtDay(range.to, { weekday: false, year: true })}. Məlumat ${rules.retentionDays} gün saxlanılır — bu müddət daxilində istənilən aralığı seçib ixrac edə bilərsiniz.`}
        actions={
          <>
            <a href={`/api/hesabat?${exportQs("xlsx")}`} className={btn("primary", "sm")}><FileSpreadsheet className="size-4" /> Excel (tam hesabat)</a>
            <details className="relative">
              <summary className={btn("secondary", "sm", "list-none cursor-pointer")}><Download className="size-4" /> CSV</summary>
              <div className="absolute right-0 z-20 mt-2 w-56 overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-lift">
                {[["reservations", "Rezervasiyalar"], ["participants", "İştirakçılar"], ["equipment", "Avadanlıq"]].map(([k, l]) => (
                  <a key={k} href={`/api/hesabat?${exportQs("csv", k)}`} className="block px-4 py-2.5 text-sm text-brand-900 hover:bg-brand-50">{l} (.csv)</a>
                ))}
              </div>
            </details>
          </>
        }
      />

      {/* Filtrlər — bir sırada */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2">
          {PRESETS.map((p) => (
            <Link key={p.key} href={`/admin/hesabatlar?${q({ p: p.key })}`} className={cx("rounded-xl px-3 py-1.5 text-sm font-medium", range.preset === p.key ? "bg-brand-500 text-white" : "bg-brand-50 text-brand-800 hover:bg-brand-100")}>{p.label}</Link>
          ))}
          <form className="ml-auto flex flex-wrap items-center gap-2">
            <CalendarRange className="size-4 text-brand-500" />
            <input type="date" name="from" defaultValue={range.from} min={range.minDay} max={range.today} className="field-input w-auto py-1.5 text-sm" aria-label="Başlanğıc tarixi" />
            <span className="text-brand-900/40">—</span>
            <input type="date" name="to" defaultValue={range.to} min={range.minDay} className="field-input w-auto py-1.5 text-sm" aria-label="Bitmə tarixi" />
            {ctx.superAdmin && !ctx.libraryId && (
              <select name="k" defaultValue={sp.k ?? ""} className="field-input w-auto py-1.5 text-sm" aria-label="Kitabxana">
                <option value="">Bütün kitabxanalar</option>
                {libraries.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            )}
            <button className={btn("secondary", "sm")}>Göstər</button>
          </form>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Rezervasiyalar" value={s.total} icon={<BarChart3 className="size-5" />} hint={`${s.cancelled} ləğv · ${s.upcoming} gələcək`} />
        <Stat label="İstifadə olunub" value={s.used} icon={<Users className="size-5" />} tone="mint" hint={`${s.uniqueUsers} unikal tələbə`} />
        <Stat label="Doluluq" value={`${s.utilization}%`} icon={<Gauge className="size-5" />} tone="sky" hint="istifadə saatı / mümkün saat" />
        <Stat label="Gəlməmə nisbəti" value={`${s.noShowRate}%`} icon={<UserX className="size-5" />} tone={s.noShowRate > 20 ? "danger" : "brand"} hint={`${s.noShow} rezerv`} />
        <Stat label="İstifadə saatı" value={s.usedHours} icon={<Clock3 className="size-5" />} />
        <Stat label="Orta iştirakçı" value={s.avgParty} icon={<Users className="size-5" />} tone="cream" hint={`${s.groupShare}% qrup rezervi`} />
        <Stat label="Əlavə vaxt müraciəti" value={s.extensions.total} icon={<Timer className="size-5" />} hint={`${s.extensions.approved} təsdiq · ${s.extensions.rejected} rədd`} />
        <Stat label="Avadanlıq rezervi" value={s.equipment.total} icon={<Laptop className="size-5" />} tone={s.equipment.late ? "danger" : "sky"} hint={`${s.equipment.hours} saat · ${s.equipment.late} gecikmə`} />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <SectionTitle>Günlük istifadə</SectionTitle>
          <p className="-mt-2 mb-4 text-xs text-brand-900/55">QR ilə təsdiqlənmiş otaq rezervləri, gün üzrə</p>
          <ColumnChart valueLabel="İstifadə olunan rezerv" data={r.daily.map((d) => ({ key: d.day, label: fmtDay(d.day), short: shortDay(d.day), value: d.used, extra: `${d.total} rezerv · ${d.noShow} gəlmədi · ${d.hours} saat` }))} />
        </Card>
        <Card className="p-5">
          <SectionTitle>Saatlar üzrə doluluq</SectionTitle>
          <p className="-mt-2 mb-4 text-xs text-brand-900/55">Həftə günü və saat üzrə otaqların orta doluluğu — ən sıx vaxtlar tünd rəngdədir</p>
          <Heatmap hours={r.heatmap.hours} rows={r.heatmap.rows} />
        </Card>
      </div>

      {!libraryId && r.byLibrary.length > 0 && (
        <Card className="overflow-x-auto p-5">
          <SectionTitle>Kitabxanalar üzrə müqayisə</SectionTitle>
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-brand-100 text-left text-xs font-semibold text-brand-900/55 uppercase"><tr><th className="py-2">Kitabxana</th><th>Otaq</th><th>Rezerv</th><th>İstifadə</th><th>Saat</th><th>Doluluq</th><th>Gəlməmə</th><th>Avadanlıq</th></tr></thead>
            <tbody className="divide-y divide-brand-100">
              {r.byLibrary.map((l) => (
                <tr key={l.id}>
                  <td className="py-2.5 font-medium text-brand-900">{l.name}{l.archived && <Badge tone="neutral" className="ml-2">arxiv</Badge>}</td>
                  <td className="tabular-nums">{l.rooms}</td><td className="tabular-nums">{l.total}</td><td className="tabular-nums">{l.used}</td><td className="tabular-nums">{l.hours}</td>
                  <td><div className="flex items-center gap-2"><div className="h-2 w-20 rounded-full bg-brand-50"><div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.min(100, l.utilization)}%` }} /></div><span className="tabular-nums">{l.utilization}%</span></div></td>
                  <td className="tabular-nums">{l.noShowRate}%</td><td className="tabular-nums">{l.equipment}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <div className="grid gap-6 xl:grid-cols-2">
        <Card className="p-5">
          <SectionTitle>Otaqlar</SectionTitle>
          <BarList valueLabel="İstifadə saatı" unit=" saat" sub="İstifadə saatı və doluluq faizi" rows={r.byRoom.map((x) => ({ key: x.id, label: `${x.name}${libraryId ? "" : ` — ${x.library}`}`, value: x.hours, note: `${x.used} istifadə · ${x.noShow} gəlmədi · doluluq ${x.utilization}%` }))} />
        </Card>
        <Card className="p-5">
          <SectionTitle>Fakültələr üzrə istifadə</SectionTitle>
          <BarList valueLabel="İstifadə saatı" unit=" saat" sub="Tələbənin fakültəsinə görə (QR ilə təsdiqləyən iştirakçılar)" rows={r.byFaculty.map((x) => ({ key: x.key, label: x.label, value: x.hours, note: `${x.visits} ziyarət · ${x.students} tələbə · ${x.noShows} gəlmədi` }))} />
        </Card>
        <Card className="p-5">
          <SectionTitle>Kurslar üzrə istifadə</SectionTitle>
          <BarList valueLabel="Ziyarət" sub="Ziyarət sayı (QR təsdiqi)" rows={r.byCourse.map((x) => ({ key: x.key, label: x.label, value: x.visits, note: `${x.hours} saat · ${x.students} tələbə` }))} />
        </Card>
        <Card className="p-5">
          <SectionTitle>Ən aktiv qruplar</SectionTitle>
          <BarList valueLabel="Ziyarət" sub="İlk 15 qrup" rows={r.byGroup.map((x) => ({ key: x.key, label: x.label, value: x.visits, note: `${x.hours} saat · ${x.students} tələbə` }))} />
        </Card>
      </div>

      <Card className="overflow-x-auto p-5">
        <SectionTitle>Ən aktiv tələbələr</SectionTitle>
        {r.topStudents.length === 0 ? <p className="text-sm text-brand-900/55">Bu dövr üçün məlumat yoxdur.</p> : (
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-brand-100 text-left text-xs font-semibold text-brand-900/55 uppercase"><tr><th className="py-2">Tələbə</th><th>Fakültə</th><th>Kurs</th><th>Qrup</th><th>Ziyarət</th><th>Saat</th><th>Gəlmədi</th></tr></thead>
            <tbody className="divide-y divide-brand-100">
              {r.topStudents.map((x) => (
                <tr key={x.user.id}>
                  <td className="py-2.5"><Link href={`/admin/istifadeciler/${x.user.id}`} className="font-medium text-brand-900 hover:underline">{x.user.name ?? x.user.email}</Link></td>
                  <td className="text-brand-900/75">{x.user.faculty ?? "—"}</td><td className="text-brand-900/75">{COURSE_LABEL(x.user.course)}</td><td className="text-brand-900/75">{x.user.groupName ?? "—"}</td>
                  <td className="tabular-nums">{x.visits}</td><td className="tabular-nums">{x.hours}</td><td className={cx("tabular-nums", x.noShows > 0 && "text-danger")}>{x.noShows}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card className="overflow-x-auto p-5">
        <SectionTitle>Avadanlıq</SectionTitle>
        <div className="mb-4 flex flex-wrap gap-2 text-sm">
          <Badge tone="info">{s.equipment.laptops} noutbuk rezervi</Badge><Badge tone="cream">{s.equipment.adapters} adapter rezervi</Badge>
          <Badge tone="success">{s.equipment.used} təhvil verilib</Badge><Badge tone="warning">{s.equipment.notPicked} götürülmədi</Badge>
          <Badge tone={s.equipment.late ? "danger" : "neutral"}>{s.equipment.late} gecikmə / qaytarılmama</Badge>
        </div>
        {r.equipmentByItem.length > 0 && (
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-brand-100 text-left text-xs font-semibold text-brand-900/55 uppercase"><tr><th className="py-2">Avadanlıq</th><th>Növ</th><th>Kitabxana</th><th>Rezerv</th><th>Saat</th><th>Gecikmə</th></tr></thead>
            <tbody className="divide-y divide-brand-100">
              {r.equipmentByItem.map((e) => (
                <tr key={e.tag}><td className="py-2.5 font-medium text-brand-900">{e.tag} <span className="font-normal text-brand-900/50">{e.name}</span></td><td>{e.type === "LAPTOP" ? "Noutbuk" : "Adapter"}</td><td>{e.library}</td><td className="tabular-nums">{e.reservations}</td><td className="tabular-nums">{e.hours}</td><td className={cx("tabular-nums", e.late > 0 && "text-danger")}>{e.late}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
