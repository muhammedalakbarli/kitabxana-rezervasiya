import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarCheck2, Clock3, DoorOpen, Laptop, MessageSquareText, RefreshCw, ShieldBan, UserX, Wrench } from "lucide-react";
import { runSweepAction, setScopeAction } from "@/app/actions/admin";
import { SubmitButton } from "@/components/submit-button";
import { DayTimeline, TimelineLegend } from "@/components/timeline";
import { Badge, Card, EmptyState, PageHeader, SectionTitle, Stat } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { equipmentBlocks, roomBlocks } from "@/lib/availability";
import { db } from "@/lib/db";
import { auditLabel, RESERVATION_STATUS } from "@/lib/labels";
import { roomHours } from "@/lib/rules";
import { runSweep } from "@/lib/sweep";
import { addDays, dayKey, fmtDay, fmtRange, fmtRelative, fmtTime, hhmm, zoned } from "@/lib/time";

export default async function AdminHome() {
  const ctx = await requireStaff();
  await runSweep();
  const today = dayKey(new Date());
  const from = zoned(today, 0);
  const to = zoned(addDays(today, 1), 0);
  const now = new Date();
  const libs = await db.library.findMany({
    where: { archivedAt: null, ...(ctx.libraryId ? { id: ctx.libraryId } : {}) },
    orderBy: { sortOrder: "asc" },
    include: {
      faculty: true,
      rooms: { where: { archivedAt: null }, orderBy: { sortOrder: "asc" }, include: { photos: { take: 1, orderBy: { sortOrder: "asc" } } } },
      equipment: { where: { archivedAt: null }, orderBy: [{ type: "asc" }, { sortOrder: "asc" }] },
    },
  });
  const libIds = libs.map((l) => l.id);
  const roomFilter = { room: { libraryId: { in: libIds } } };
  const eqFilter = { equipment: { libraryId: { in: libIds } } };
  const [todayRes, activeNow, pendingReq, issued, overdue, blocked, noShowWeek, recent] = await Promise.all([
    db.reservation.findMany({ where: { startAt: { gte: from, lt: to }, ...roomFilter }, include: { room: true, owner: true, participants: true }, orderBy: { startAt: "asc" } }),
    db.reservation.count({ where: { status: "ACTIVE", ...roomFilter } }),
    db.extensionRequest.count({ where: { status: "PENDING", reservation: roomFilter } }),
    db.equipmentReservation.count({ where: { status: "ISSUED", ...eqFilter } }),
    db.equipmentReservation.findMany({ where: { status: "OVERDUE", ...eqFilter }, include: { equipment: true, user: true }, take: 10 }),
    db.user.count({ where: { blockedAt: { not: null } } }),
    db.reservation.count({ where: { status: "NO_SHOW", startAt: { gte: new Date(Date.now() - 7 * 86400_000) }, ...roomFilter } }),
    ctx.superAdmin ? db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, include: { actor: { select: { name: true, email: true } } } }) : Promise.resolve([]),
  ]);

  const stats = (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Stat label="Bu günkü rezervasiyalar" value={todayRes.filter((r) => r.status !== "CANCELLED").length} icon={<CalendarCheck2 className="size-5" />} />
      <Stat label="Hazırda istifadədə" value={activeNow} icon={<DoorOpen className="size-5" />} tone="mint" />
      <Stat label="Baxılmamış müraciət" value={pendingReq} icon={<MessageSquareText className="size-5" />} tone="cream" hint={pendingReq ? <Link href="/admin/muracietler" className="font-semibold text-brand-600">Bax →</Link> : undefined} />
      <Stat label="Təhvildə olan avadanlıq" value={issued} icon={<Laptop className="size-5" />} tone="sky" />
      <Stat label="Qaytarılmayan avadanlıq" value={overdue.length} icon={<AlertTriangle className="size-5" />} tone={overdue.length ? "danger" : "brand"} />
      <Stat label="Gəlməmə (son 7 gün)" value={noShowWeek} icon={<UserX className="size-5" />} />
      <Stat label="Bloklanmış istifadəçi" value={blocked} icon={<ShieldBan className="size-5" />} tone={blocked ? "danger" : "brand"} />
    </div>
  );

  // ── Super admin: bütün kitabxanalar ────────────────────────────────
  if (ctx.superAdmin && !ctx.libraryId) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow={fmtDay(today)}
          title="Bütün kitabxanalar"
          subtitle="Fakültə kitabxanalarının canlı vəziyyəti. Kitabxanaya daxil olmaq üçün kartı seçin."
          actions={<form action={runSweepAction}><SubmitButton variant="secondary" size="sm"><RefreshCw className="size-4" /> Yenilə</SubmitButton></form>}
        />
        {stats}
        <section>
          <SectionTitle>Kitabxanalar</SectionTitle>
          {libs.length === 0 ? (
            <EmptyState title="Hələ kitabxana yoxdur" action={<Link href="/admin/idare/kitabxanalar" className="font-semibold text-brand-600">Kitabxana əlavə et →</Link>} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {libs.map((lib) => {
                const list = todayRes.filter((r) => r.room.libraryId === lib.id && r.status !== "CANCELLED");
                const busyNow = new Set(list.filter((r) => r.startAt <= now && r.endAt > now && (r.status === "ACTIVE" || r.status === "BOOKED")).map((r) => r.roomId));
                const maint = lib.rooms.filter((r) => r.underMaintenance).length;
                const free = lib.rooms.filter((r) => !busyNow.has(r.id) && !r.underMaintenance && r.isActive).length;
                return (
                  <Card key={lib.id} className="overflow-hidden">
                    <div className="flex gap-4 p-4">
                      <div className="relative size-20 shrink-0 overflow-hidden rounded-2xl bg-brand-50">
                        {(lib.coverPhoto ?? lib.rooms[0]?.photos[0]?.url) && <Image src={(lib.coverPhoto ?? lib.rooms[0]?.photos[0]?.url)!} alt="" fill sizes="80px" className="object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-semibold text-brand-900">{lib.name}</div>
                        <div className="truncate text-sm text-brand-900/60">{lib.faculty?.name ?? lib.building} · {hhmm(lib.openMinute)}–{hhmm(lib.closeMinute)}</div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge tone="success">{free}/{lib.rooms.length} otaq boşdur</Badge>
                          <Badge tone="info">{list.length} rezerv bu gün</Badge>
                          {maint > 0 && <Badge tone="warning"><Wrench className="size-3" /> {maint} təmirdə</Badge>}
                          {!lib.isActive && <Badge tone="danger">Deaktiv</Badge>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-brand-100 bg-brand-50/40 px-4 py-2.5">
                      <span className="text-xs text-brand-900/55">{lib.equipment.length} avadanlıq · {lib.rooms.length} otaq</span>
                      <form action={setScopeAction}>
                        <input type="hidden" name="libraryId" value={lib.id} />
                        <input type="hidden" name="back" value="/admin" />
                        <SubmitButton size="sm">Daxil ol <ArrowRight className="size-4" /></SubmitButton>
                      </form>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </section>
        {recent.length > 0 && (
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
        )}
      </div>
    );
  }

  // ── Bir kitabxananın canlı vəziyyəti ───────────────────────────────
  const lib = libs[0];
  if (!lib) return <EmptyState title="Kitabxana tapılmadı" />;
  const hours = roomHours(lib);
  const open = zoned(today, hours.openMinute).getTime();
  const close = zoned(today, hours.closeMinute).getTime();
  const rooms = await Promise.all(lib.rooms.map(async (r) => ({ r, blocks: await roomBlocks(db, r.id, new Date(open), new Date(close), null) })));
  const eqOpen = zoned(today, lib.openMinute).getTime();
  const eqClose = zoned(today, lib.closeMinute).getTime();
  const equipment = await Promise.all(lib.equipment.map(async (e) => ({ e, blocks: await equipmentBlocks(db, e.id, new Date(eqOpen), new Date(eqClose), null) })));
  const upcoming = todayRes.filter((r) => (r.status === "BOOKED" || r.status === "ACTIVE") && r.endAt > now).slice(0, 8);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow={`${fmtDay(today)} · ${lib.faculty?.name ?? lib.building}`}
        title={lib.name}
        subtitle={`İş saatları ${hhmm(lib.openMinute)}–${hhmm(lib.closeMinute)} · otaq rezervasiyası ${hhmm(hours.openMinute)}–${hhmm(hours.closeMinute)}`}
        actions={
          <>
            {ctx.superAdmin && (
              <form action={setScopeAction}><input type="hidden" name="libraryId" value="all" /><SubmitButton variant="ghost" size="sm">← Bütün kitabxanalar</SubmitButton></form>
            )}
            <form action={runSweepAction}><SubmitButton variant="secondary" size="sm"><RefreshCw className="size-4" /> Yenilə</SubmitButton></form>
          </>
        }
      />
      {stats}

      {overdue.length > 0 && (
        <Card className="p-5 ring-1 ring-danger/25">
          <SectionTitle><span className="inline-flex items-center gap-2 text-danger"><AlertTriangle className="size-5" /> Qaytarılmayan avadanlıq</span></SectionTitle>
          <ul className="divide-y divide-brand-100">
            {overdue.map((o) => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <span><b>{o.equipment.assetTag}</b> — {o.user.name ?? o.user.email}</span>
                <span className="text-danger">Qaytarma vaxtı {fmtTime(o.endAt)} ({fmtRelative(o.endAt)})</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[17px] font-semibold text-brand-900">Otaqlar — canlı cədvəl</h2>
          <TimelineLegend />
        </div>
        <Card className="p-5">
          {rooms.length === 0 ? <EmptyState title="Otaq yoxdur" /> : (
            <div className="space-y-4">
              {rooms.map(({ r, blocks }) => {
                const nowBlock = blocks.find((b) => b.start <= now.getTime() && b.end > now.getTime() && b.kind !== "hold" && b.kind !== "hold-mine");
                return (
                  <div key={r.id} className="grid items-center gap-2 sm:grid-cols-[150px_1fr]">
                    <div>
                      <div className="text-sm font-semibold text-brand-900">{r.name}{r.code && <span className="font-normal text-brand-900/50"> · {r.code}</span>}</div>
                      {r.underMaintenance ? <Badge tone="warning"><Wrench className="size-3" /> Təmirdə</Badge> : nowBlock ? <Badge tone={nowBlock.kind === "active" ? "success" : "info"}>{nowBlock.kind === "active" ? "İstifadədə" : "Rezervdə"}</Badge> : <Badge tone="neutral">Boş</Badge>}
                    </div>
                    <DayTimeline open={open} close={close} blocks={blocks} showOwners />
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <section>
          <SectionTitle action={<Link href="/admin/rezervasiyalar" className="text-sm font-semibold text-brand-600">Hamısı →</Link>}>Bu günün növbəti rezervləri</SectionTitle>
          {upcoming.length === 0 ? <EmptyState icon={<Clock3 />} title="Gözlənilən rezerv yoxdur" /> : (
            <Card className="divide-y divide-brand-100">
              {upcoming.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-sm">
                  <span className="min-w-0"><b className="tabular-nums">{fmtRange(r.startAt, r.endAt)}</b> · {r.room.name} · <span className="text-brand-900/70">{r.owner.name ?? r.owner.email}</span></span>
                  <span className="flex items-center gap-2"><span className="text-xs text-brand-900/50">QR {r.participants.filter((p) => p.checkedInAt).length}/{Math.min(r.partyCategory, 4)}</span><Badge tone={RESERVATION_STATUS[r.status].tone}>{RESERVATION_STATUS[r.status].label}</Badge></span>
                </div>
              ))}
            </Card>
          )}
        </section>
        <section>
          <SectionTitle action={<Link href="/admin/avadanliq" className="text-sm font-semibold text-brand-600">Masa →</Link>}>Avadanlıq</SectionTitle>
          {equipment.length === 0 ? <EmptyState icon={<Laptop />} title="Bu kitabxanada avadanlıq yoxdur" /> : (
            <Card className="divide-y divide-brand-100">
              {equipment.map(({ e, blocks }) => {
                const cur = blocks.find((b) => b.start <= now.getTime() && b.end > now.getTime());
                return (
                  <div key={e.id} className="grid items-center gap-3 px-4 py-2.5 text-sm sm:grid-cols-[110px_1fr_auto]">
                    <span className="font-semibold text-brand-900">{e.assetTag}</span>
                    <DayTimeline open={eqOpen} close={eqClose} blocks={blocks} compact />
                    {e.underMaintenance ? <Badge tone="warning">Təmirdə</Badge> : cur ? <Badge tone={cur.kind === "booked" ? "info" : "success"}>{cur.kind === "booked" ? "Rezervdə" : "İstifadədə"}</Badge> : <Badge tone="neutral">Boş</Badge>}
                  </div>
                );
              })}
            </Card>
          )}
        </section>
      </div>
    </div>
  );
}
