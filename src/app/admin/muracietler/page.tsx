import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Inbox, XCircle } from "lucide-react";
import { decideExtensionAction } from "@/app/actions/admin";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Avatar, Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { REQUEST_STATUS } from "@/lib/labels";
import { extensionFeasibility } from "@/lib/reservations";
import { dayKey, fmtDateTime, fmtDay, fmtRange, fmtRelative, fmtTime } from "@/lib/time";

export const metadata: Metadata = { title: "Müraciətlər" };

export default async function RequestsPage() {
  const ctx = await requireStaff();
  const scope = ctx.libraryId ? { reservation: { room: { libraryId: ctx.libraryId } } } : {};
  const include = { requester: true, decidedBy: true, reservation: { include: { room: { include: { library: true } } } } } as const;
  const [pending, history] = await Promise.all([
    db.extensionRequest.findMany({ where: { status: "PENDING", ...scope }, include, orderBy: { createdAt: "asc" } }),
    db.extensionRequest.findMany({ where: { status: { not: "PENDING" }, ...scope }, include, orderBy: { createdAt: "desc" }, take: 30 }),
  ]);
  const feas = await Promise.all(pending.map((q) => extensionFeasibility(q.id)));

  return (
    <div>
      <PageHeader title="Əlavə vaxt müraciətləri" subtitle="Tələbələrin səbəb göstərərək göndərdiyi müraciətlər. Təsdiq zamanı vaxtın boş olması avtomatik yoxlanılır." />
      <section className="mb-10">
        <SectionTitle>Baxılmamış <Badge tone="warning" className="ml-1">{pending.length}</Badge></SectionTitle>
        {pending.length === 0 ? (
          <EmptyState icon={<Inbox />} title="Yeni müraciət yoxdur" />
        ) : (
          <div className="space-y-3">
            {pending.map((q, i) => {
              const r = q.reservation;
              const f = feas[i];
              return (
                <Card key={q.id} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex gap-3">
                      <Avatar name={q.requester.name} email={q.requester.email} size={40} />
                      <div>
                        <Link href={`/admin/istifadeciler/${q.requesterId}`} className="font-semibold text-brand-900 hover:underline">{q.requester.name ?? q.requester.email}</Link>
                        <div className="text-xs text-brand-900/55">{q.requester.faculty ?? q.requester.department ?? q.requester.email}{q.requester.groupName ? ` · ${q.requester.groupName}` : ""}</div>
                        <div className="mt-2 text-sm text-brand-900">{r.room.name}{r.room.code ? ` · ${r.room.code}` : ""} — {r.room.library.shortName} · {fmtDay(dayKey(r.startAt))}, {fmtRange(r.startAt, r.endAt)}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-semibold text-brand-900">+{q.minutes} dəq</div>
                      <div className="text-xs text-brand-900/50">{fmtRelative(q.createdAt)}</div>
                    </div>
                  </div>
                  <blockquote className="mt-4 rounded-xl bg-brand-50/70 px-4 py-3 text-sm leading-relaxed text-brand-900">“{q.reason}”</blockquote>
                  <div className="mt-3">
                    {f.feasible ? (
                      <Alert tone="success">Vaxt boşdur — təsdiqlənərsə rezervasiya {fmtTime(f.newEnd!)}-a qədər uzadılacaq.</Alert>
                    ) : (
                      <Alert tone="warning">Təmin etmək mümkün deyil: {f.reason}{f.newEnd ? ` (tələb olunan bitmə: ${fmtTime(f.newEnd)})` : ""}.</Alert>
                    )}
                  </div>
                  <form action={decideExtensionAction} className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <input type="hidden" name="requestId" value={q.id} />
                    <input name="note" placeholder="Qeyd (istəyə bağlı, tələbəyə göndəriləcək)" className="field-input flex-1 text-sm" />
                    <div className="flex gap-2">
                      <SubmitButton name="decision" value="reject" variant="outline"><XCircle className="size-4" /> Rədd et</SubmitButton>
                      <SubmitButton name="decision" value="approve" disabled={!f.feasible}><CheckCircle2 className="size-4" /> Təsdiqlə</SubmitButton>
                    </div>
                  </form>
                </Card>
              );
            })}
          </div>
        )}
      </section>
      <section>
        <SectionTitle>Tarixçə</SectionTitle>
        {history.length === 0 ? <EmptyState title="Hələ baxılmış müraciət yoxdur" /> : (
          <Card className="divide-y divide-brand-100">
            {history.map((q) => (
              <div key={q.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium text-brand-900">{q.requester.name ?? q.requester.email} · +{q.minutes} dəq · {q.reservation.room.name} ({q.reservation.room.library.shortName})</div>
                  <div className="truncate text-xs text-brand-900/55">{q.reason}{q.adminNote ? ` — Qeyd: ${q.adminNote}` : ""}</div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-brand-900/50">{q.decidedAt ? fmtDateTime(q.decidedAt) : fmtDateTime(q.createdAt)}{q.decidedBy ? ` · ${q.decidedBy.name ?? q.decidedBy.email}` : ""}</span>
                  <Badge tone={REQUEST_STATUS[q.status].tone}>{REQUEST_STATUS[q.status].label}</Badge>
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>
    </div>
  );
}
