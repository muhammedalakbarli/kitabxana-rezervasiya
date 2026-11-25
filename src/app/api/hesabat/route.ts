import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { buildReport, COURSE_LABEL } from "@/lib/analytics";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { resolveRange } from "@/lib/report-range";
import { getRules } from "@/lib/settings";
import { buildCsv, buildXlsx, type Sheet } from "@/lib/xlsx";
import { fmtDay } from "@/lib/time";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user || !isStaff(user)) return NextResponse.json({ error: "İcazə yoxdur" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const rules = await getRules();
  const range = resolveRange({ from: sp.get("from"), to: sp.get("to"), p: sp.get("p") }, rules.retentionDays);
  let libraryId: string | null = null;
  if (user.role === "SUPERVISOR") {
    if (!user.libraryId) return NextResponse.json({ error: "Kitabxana təyin olunmayıb" }, { status: 403 });
    libraryId = user.libraryId;
  } else {
    const k = sp.get("k");
    if (k && (await db.library.findUnique({ where: { id: k }, select: { id: true } }))) libraryId = k;
  }
  const r = await buildReport({ from: range.from, to: range.to, libraryId });
  const format = sp.get("format") ?? "xlsx";
  const base = `kitabxana-hesabat_${r.libraryName.replace(/[^\p{L}\p{N}]+/gu, "-").toLowerCase()}_${range.from}_${range.to}`;
  await audit(user.id, "report.exported", "Report", libraryId, { from: range.from, to: range.to, format });

  if (format === "csv") {
    const dataset = sp.get("dataset") ?? "reservations";
    const rows = dataset === "equipment" ? r.rows.equipment : dataset === "participants" ? r.rows.participants : r.rows.reservations;
    return new NextResponse(buildCsv(rows), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${base}_${dataset}.csv`)}` },
    });
  }

  const s = r.summary;
  const sheets: Sheet[] = [
    {
      name: "Xülasə",
      header: ["Göstərici", "Dəyər"],
      data: [
        ["Hesabat", r.libraryName],
        ["Dövr", `${fmtDay(range.from, { year: true, weekday: false })} — ${fmtDay(range.to, { year: true, weekday: false })}`],
        ["Rezervasiyalar (ləğv edilənlər istisna)", s.total],
        ["İstifadə olunub (QR ilə təsdiqlənib)", s.used],
        ["Gəlmədi", s.noShow],
        ["Ləğv edilib", s.cancelled],
        ["Gələcək (hələ başlamayıb)", s.upcoming],
        ["İstifadə saatı", s.usedHours],
        ["Doluluq (%)", s.utilization],
        ["Gəlməmə nisbəti (%)", s.noShowRate],
        ["Unikal tələbə", s.uniqueUsers],
        ["Orta iştirakçı sayı", s.avgParty],
        ["Qrup rezervləri (%)", s.groupShare],
        ["Növbəyə yazılma", s.waitlist],
        ["Əlavə vaxt müraciəti (cəmi / təsdiq / rədd)", `${s.extensions.total} / ${s.extensions.approved} / ${s.extensions.rejected}`],
        ["Avadanlıq rezervi", s.equipment.total],
        ["Avadanlıq — noutbuk / adapter", `${s.equipment.laptops} / ${s.equipment.adapters}`],
        ["Avadanlıq istifadə saatı", s.equipment.hours],
        ["Avadanlıq — götürülmədi", s.equipment.notPicked],
        ["Avadanlıq — gecikmə / qaytarılmama", s.equipment.late],
        ["Hazırlanıb", new Date().toLocaleString("az-AZ", { timeZone: "Asia/Baku" })],
      ],
    },
    ...(libraryId ? [] : [{ name: "Kitabxanalar", header: ["Kitabxana", "Otaq", "Rezerv", "İstifadə", "Saat", "Doluluq %", "Gəlməmə %", "Avadanlıq rezervi"], data: r.byLibrary.map((l) => [l.name + (l.archived ? " (arxiv)" : ""), l.rooms, l.total, l.used, l.hours, l.utilization, l.noShowRate, l.equipment]) }]),
    { name: "Otaqlar", header: ["Otaq", "Kitabxana", "Rezerv", "İstifadə", "Gəlmədi", "Saat", "Doluluq %"], data: r.byRoom.map((x) => [x.name + (x.archived ? " (arxiv)" : ""), x.library, x.total, x.used, x.noShow, x.hours, x.utilization]) },
    { name: "Fakültələr", header: ["Fakültə", "Ziyarət", "Saat", "Unikal tələbə", "Gəlmədi"], data: r.byFaculty.map((x) => [x.label, x.visits, x.hours, x.students, x.noShows]) },
    { name: "Kurslar", header: ["Kurs", "Ziyarət", "Saat", "Unikal tələbə", "Gəlmədi"], data: r.byCourse.map((x) => [x.label, x.visits, x.hours, x.students, x.noShows]) },
    { name: "Qruplar", header: ["Qrup", "Ziyarət", "Saat", "Unikal tələbə", "Gəlmədi"], data: r.byGroup.map((x) => [x.label, x.visits, x.hours, x.students, x.noShows]) },
    { name: "Aktiv tələbələr", header: ["Tələbə", "E-poçt", "Fakültə", "Kurs", "Qrup", "Ziyarət", "Saat", "Rezerv edib", "Gəlmədi"], data: r.topStudents.map((x) => [x.user.name ?? "", x.user.email, x.user.faculty ?? "", COURSE_LABEL(x.user.course), x.user.groupName ?? "", x.visits, x.hours, x.owned, x.noShows]) },
    { name: "Günlük", header: ["Tarix", "Rezerv", "İstifadə", "Gəlmədi", "Saat"], data: r.daily.map((d) => [d.day, d.total, d.used, d.noShow, d.hours]) },
    { name: "Saatlar üzrə doluluq", header: ["Gün", ...r.heatmap.hours.map((h) => `${h}:00`)], data: r.heatmap.rows.map((row) => [["B.e.", "Ç.a.", "Çər.", "C.a.", "Cümə", "Şən.", "Baz."][row.weekday - 1], ...row.values]) },
    { name: "Rezervasiyalar", rows: r.rows.reservations },
    { name: "İştirakçılar", rows: r.rows.participants },
    { name: "Avadanlıq", rows: r.rows.equipment },
    { name: "Avadanlıq üzrə", header: ["Etiket", "Ad", "Növ", "Kitabxana", "Rezerv", "Saat", "Gecikmə"], data: r.equipmentByItem.map((e) => [e.tag, e.name, e.type === "LAPTOP" ? "Noutbuk" : "Adapter", e.library, e.reservations, e.hours, e.late]) },
  ];
  const xlsx = buildXlsx(sheets, { title: `Kitabxana hesabatı — ${r.libraryName}` });
  return new NextResponse(new Uint8Array(xlsx), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${base}.xlsx`)}`,
    },
  });
}
