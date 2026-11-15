import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma, ReservationStatus } from "@prisma/client";
import { CheckCircle2, Filter } from "lucide-react";
import { adminCancelReservationAction, staffCheckInAction } from "@/app/actions/admin";
import { ConfirmSubmit, SubmitButton } from "@/components/submit-button";
import { Badge, Card, EmptyState, PageHeader, btn } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { INVITE_STATUS, RESERVATION_STATUS } from "@/lib/labels";
import { runSweep } from "@/lib/sweep";
import { addDays, dayKey, fmtDay, fmtRange, fmtTime, isValidDayKey, zoned } from "@/lib/time";

export const metadata: Metadata = { title: "Rezervasiyalar" };

type SP = { kitabxana?: string; gun?: string; status?: string; q?: string };

export default async function AdminReservations({ searchParams }: { searchParams: Promise<SP> }) {
  await requireStaff();
  await runSweep();
  const sp = await searchParams;
  const day = isValidDayKey(sp.gun) ? sp.gun : dayKey(new Date());
  const statuses = Object.keys(RESERVATION_STATUS) as ReservationStatus[];
  const status = statuses.includes(sp.status as ReservationStatus) ? (sp.status as ReservationStatus) : undefined;
  const libraries = await db.library.findMany({ orderBy: { sortOrder: "asc" } });
  const q = sp.q?.trim();
  const where: Prisma.ReservationWhereInput = {
    startAt: { gte: zoned(day, 0), lt: zoned(addDays(day, 1), 0) },
    ...(sp.kitabxana ? { room: { libraryId: sp.kitabxana } } : {}),
    ...(status ? { status } : {}),
    ...(q ? { participants: { some: { user: { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } } } } : {}),
  };
  const rows = await db.reservation.findMany({
    where,
    include: { room: { include: { library: true } }, owner: true, participants: { include: { user: true }, orderBy: { role: "asc" } } },
    orderBy: [{ startAt: "asc" }],
    take: 300,
  });
  const backUrl = `/admin/rezervasiyalar?gun=${day}${sp.kitabxana ? `&kitabxana=${sp.kitabxana}` : ""}${status ? `&status=${status}` : ""}`;

  return (
    <div>
      <PageHeader title="Rezervasiyalar" subtitle={`${fmtDay(day, { year: true })} · ${rows.length} rezervasiya`} />
      <Card className="mb-5 p-4">
        <form className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_1.3fr_auto]">
          <input type="date" name="gun" defaultValue={day} className="field-input" aria-label="Tarix" />
          <select name="kitabxana" defaultValue={sp.kitabxana ?? ""} className="field-input" aria-label="Kitabxana">
            <option value="">Bütün kitabxanalar</option>
            {libraries.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <select name="status" defaultValue={status ?? ""} className="field-input" aria-label="Status">
            <option value="">Bütün statuslar</option>
            {statuses.map((s) => <option key={s} value={s}>{RESERVATION_STATUS[s].label}</option>)}
          </select>
          <input name="q" defaultValue={q} placeholder="Ad və ya e-poçt" className="field-input" aria-label="Axtarış" />
          <button className={btn("primary")}><Filter className="size-4" /> Süz</button>
        </form>
      </Card>

      {rows.length === 0 ? (
        <EmptyState title="Bu filtrlərə uyğun rezervasiya yoxdur" />
      ) : (
        <div className="space-y-2">
          {rows.map((r) => {
            const st = RESERVATION_STATUS[r.status];
            const live = r.status === "BOOKED" || r.status === "ACTIVE";
            const checked = r.participants.filter((p) => p.checkedInAt).length;
            return (
              <Card key={r.id} className="overflow-hidden">
                <details className="group">
                  <summary className="grid cursor-pointer list-none grid-cols-[auto_1fr_auto] items-center gap-3 px-4 py-3 hover:bg-brand-50/50 sm:grid-cols-[110px_1.2fr_1.5fr_auto_auto]">
                    <span className="font-semibold tabular-nums text-brand-900">{fmtRange(r.startAt, r.endAt)}</span>
                    <span className="min-w-0 truncate text-sm text-brand-900">{r.room.name}{r.room.code ? ` · ${r.room.code}` : ""} <span className="text-brand-900/50">— {r.room.library.shortName}</span></span>
                    <span className="hidden min-w-0 truncate text-sm text-brand-900/75 sm:block">{r.owner.name ?? r.owner.email}</span>
                    <span className="hidden text-xs text-brand-900/60 sm:block">QR {checked}/{Math.min(r.partyCategory, 4)}{r.partyCategory === 4 ? "+" : ""}</span>
                    <Badge tone={st.tone}>{st.label}</Badge>
                  </summary>
                  <div className="border-t border-brand-100 bg-brand-50/40 px-4 py-4">
                    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
                      <ul className="space-y-2">
                        {r.participants.map((p) => (
                          <li key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 text-sm">
                            <Link href={`/admin/istifadeciler/${p.userId}`} className="min-w-0 truncate font-medium text-brand-900 hover:underline">
                              {p.user.name ?? p.user.email} <span className="font-normal text-brand-900/50">· {p.role === "OWNER" ? "sahib" : "dəvətli"}</span>
                            </Link>
                            <span className="flex flex-wrap items-center gap-2">
                              {p.role === "GUEST" && <Badge tone={INVITE_STATUS[p.inviteStatus].tone}>{INVITE_STATUS[p.inviteStatus].label}</Badge>}
                              {p.checkedInAt ? (
                                <Badge tone="success"><CheckCircle2 className="size-3" /> {fmtTime(p.checkedInAt)}{p.checkInMethod === "staff" ? " (əl ilə)" : ""}</Badge>
                              ) : live && !r.finalizedAt && p.inviteStatus !== "DECLINED" ? (
                                <form action={staffCheckInAction}>
                                  <input type="hidden" name="participantId" value={p.id} />
                                  <input type="hidden" name="back" value={backUrl} />
                                  <SubmitButton size="sm" variant="secondary">Əl ilə təsdiqlə</SubmitButton>
                                </form>
                              ) : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div className="space-y-2 text-sm">
                        {r.purpose && <p className="text-brand-900/75"><b>Məqsəd:</b> {r.purpose}</p>}
                        <p className="text-brand-900/60">İlkin bitmə: {fmtTime(r.plannedEndAt)}{r.cancelReason ? ` · ${r.cancelReason}` : ""}</p>
                        {live && (
                          <form action={adminCancelReservationAction} className="space-y-2">
                            <input type="hidden" name="id" value={r.id} />
                            <input type="hidden" name="back" value={backUrl} />
                            <input name="reason" placeholder="Ləğv səbəbi (istifadəçiyə göndəriləcək)" className="field-input text-sm" />
                            <ConfirmSubmit question="Ləğv edilsin?" confirmText="Ləğv et">{r.status === "ACTIVE" ? "Bitir / boşalt" : "Rezervasiyanı ləğv et"}</ConfirmSubmit>
                          </form>
                        )}
                      </div>
                    </div>
                  </div>
                </details>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
