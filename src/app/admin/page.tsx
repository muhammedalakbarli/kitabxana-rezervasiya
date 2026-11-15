import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarCheck2, DoorOpen, Laptop, MessageSquareText, RefreshCw, ShieldBan, UserX } from "lucide-react";
import { runSweepAction } from "@/app/actions/admin";
import { SubmitButton } from "@/components/submit-button";
import { DayTimeline, TimelineLegend } from "@/components/timeline";
import { Badge, Card, EmptyState, PageHeader, SectionTitle, Stat } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { roomBlocks } from "@/lib/availability";
import { db } from "@/lib/db";
import { runSweep } from "@/lib/sweep";
import { auditLabel } from "@/lib/labels";
import { addDays, dayKey, fmtDay, fmtRelative, fmtTime, zoned } from "@/lib/time";

export default async function AdminHome() {
  await requireStaff();
  await runSweep();
  const today = dayKey(new Date());
  const from = zoned(today, 0);
  const to = zoned(addDays(today, 1), 0);
  const weekAgo = new Date(Date.now() - 7 * 86400_000);
  const [todayCount, activeNow, pendingReq, issued, overdue, blocked, noShowWeek, libraries, recent] = await Promise.all([
    db.reservation.count({ where: { startAt: { gte: from, lt: to }, status: { notIn: ["CANCELLED"] } } }),
    db.reservation.count({ where: { status: "ACTIVE" } }),
    db.extensionRequest.count({ where: { status: "PENDING" } }),
    db.equipmentReservation.count({ where: { status: "ISSUED" } }),
    db.equipmentReservation.findMany({ where: { status: "OVERDUE" }, include: { equipment: true, user: true }, take: 10 }),
    db.user.count({ where: { blockedAt: { not: null } } }),
    db.reservation.count({ where: { status: "NO_SHOW", startAt: { gte: weekAgo } } }),
    db.library.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, include: { rooms: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } } }),
    db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { actor: { select: { name: true, email: true } } } }),
  ]);
  const boards = await Promise.all(
    libraries.map(async (lib) => ({
      lib,
      open: zoned(today, lib.openMinute).getTime(),
      close: zoned(today, lib.closeMinute).getTime(),
      rooms: await Promise.all(lib.rooms.map(async (r) => ({ r, blocks: await roomBlocks(db, r.id, zoned(today, lib.openMinute), zoned(today, lib.closeMinute), null) }))),
    })),
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={fmtDay(today)}
        title="Ümumi baxış"
        subtitle="Bütün kitabxanalar üzrə bu günün vəziyyəti."
        actions={<form action={runSweepAction}><SubmitButton variant="secondary" size="sm"><RefreshCw className="size-4" /> Vəziyyəti yenilə</SubmitButton></form>}
      />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="Bu günkü rezervasiyalar" value={todayCount} icon={<CalendarCheck2 className="size-5" />} />
        <Stat label="Hazırda istifadədə" value={activeNow} icon={<DoorOpen className="size-5" />} tone="mint" />
        <Stat label="Baxılmamış müraciət" value={pendingReq} icon={<MessageSquareText className="size-5" />} tone="cream" hint={pendingReq ? <Link href="/admin/muracietler" className="font-semibold text-brand-600">Bax →</Link> : undefined} />
        <Stat label="Təhvildə olan avadanlıq" value={issued} icon={<Laptop className="size-5" />} tone="sky" />
        <Stat label="Qaytarılmayan avadanlıq" value={overdue.length} icon={<AlertTriangle className="size-5" />} tone={overdue.length ? "danger" : "brand"} />
        <Stat label="Bloklanmış istifadəçi" value={blocked} icon={<ShieldBan className="size-5" />} tone={blocked ? "danger" : "brand"} />
        <Stat label="Gəlməmə (son 7 gün)" value={noShowWeek} icon={<UserX className="size-5" />} />
      </div>

      {overdue.length > 0 && (
        <Card className="border-danger/30 p-5">
          <SectionTitle><span className="inline-flex items-center gap-2 text-danger"><AlertTriangle className="size-5" /> Qaytarılmayan avadanlıq</span></SectionTitle>
          <ul className="divide-y divide-brand-100">
            {overdue.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span><b>{o.equipment.assetTag}</b> — {o.user.name ?? o.user.email}</span>
                <span className="text-danger">Qaytarma vaxtı {fmtTime(o.endAt)} ({fmtRelative(o.endAt)})</span>
              </li>
            ))}
          </ul>
          <Link href="/admin/avadanliq" className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-brand-600">Avadanlıq masasına keç <ArrowRight className="size-4" /></Link>
        </Card>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[17px] font-semibold text-brand-900">Canlı cədvəl</h2>
          <TimelineLegend />
        </div>
        <div className="space-y-4">
          {boards.map(({ lib, rooms, open, close }) => (
            <Card key={lib.id} className="p-5">
              <div className="mb-3 flex items-center justify-between">
                <div className="font-semibold text-brand-900">{lib.name}</div>
                <Link href={`/admin/rezervasiyalar?kitabxana=${lib.id}`} className="text-sm font-semibold text-brand-600">Rezervasiyalar →</Link>
              </div>
              {rooms.length === 0 ? <EmptyState title="Otaq yoxdur" /> : (
                <div className="space-y-3">
                  {rooms.map(({ r, blocks }) => (
                    <div key={r.id} className="grid items-center gap-2 sm:grid-cols-[120px_1fr]">
                      <div className="text-sm font-medium text-brand-900">{r.name}{r.code && <span className="block text-xs text-brand-900/50">{r.code}</span>}</div>
                      <DayTimeline open={open} close={close} blocks={blocks} showOwners compact={false} />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      </section>

      <section>
        <SectionTitle action={<Link href="/admin/jurnal" className="text-sm font-semibold text-brand-600">Hamısı →</Link>}>Son fəaliyyət</SectionTitle>
        <Card className="divide-y divide-brand-100">
          {recent.map((a) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
              <span className="text-brand-900"><Badge tone="neutral" className="mr-2">{auditLabel(a.action)}</Badge>{a.actor ? a.actor.name ?? a.actor.email : "Sistem"}</span>
              <span className="text-xs text-brand-900/50">{fmtRelative(a.createdAt)}</span>
            </div>
          ))}
        </Card>
      </section>
    </div>
  );
}
