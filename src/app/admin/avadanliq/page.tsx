import type { Metadata } from "next";
import Link from "next/link";
import { Laptop, PackageCheck, PackageOpen, Plug, TriangleAlert } from "lucide-react";
import { adminCancelEquipmentAction, issueEquipmentAction, returnEquipmentAction } from "@/app/actions/admin";
import { Countdown } from "@/components/countdown";
import { DeskReserveForm } from "@/components/desk-form";
import { ConfirmSubmit, SubmitButton } from "@/components/submit-button";
import { Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { EQUIPMENT_STATUS } from "@/lib/labels";
import { getRules } from "@/lib/settings";
import { runSweep } from "@/lib/sweep";
import { addDays, dayKey, fmtRange, fmtRelative, fmtTime, hhmm, minutesOfDay, zoned } from "@/lib/time";

export const metadata: Metadata = { title: "Avadanlıq masası" };

export default async function DeskPage() {
  await requireStaff();
  await runSweep();
  const rules = await getRules();
  const today = dayKey(new Date());
  const from = zoned(today, 0);
  const to = zoned(addDays(today, 1), 0);
  const include = { equipment: { include: { library: true } }, user: true } as const;
  const [toIssue, inUse, overdue, done, allEq] = await Promise.all([
    db.equipmentReservation.findMany({ where: { status: "BOOKED", startAt: { gte: from, lt: to } }, include, orderBy: { startAt: "asc" } }),
    db.equipmentReservation.findMany({ where: { status: "ISSUED" }, include, orderBy: { endAt: "asc" } }),
    db.equipmentReservation.findMany({ where: { status: "OVERDUE" }, include, orderBy: { endAt: "asc" } }),
    db.equipmentReservation.findMany({ where: { status: { in: ["RETURNED", "NO_SHOW", "CANCELLED"] }, startAt: { gte: from, lt: to } }, include, orderBy: { updatedAt: "desc" }, take: 30 }),
    db.equipment.findMany({ where: { isActive: true }, include: { library: true }, orderBy: [{ type: "asc" }, { sortOrder: "asc" }] }),
  ]);
  const step = 5;
  const defaultStart = hhmm(Math.ceil(minutesOfDay(new Date()) / step) * step % 1440);
  const now = Date.now();

  const Row = ({ r, children }: { r: (typeof toIssue)[number]; children?: React.ReactNode }) => {
    const Icon = r.equipment.type === "LAPTOP" ? Laptop : Plug;
    const st = EQUIPMENT_STATUS[r.status];
    return (
      <li className="flex flex-wrap items-center gap-3 px-4 py-3">
        <span className="grid size-10 place-items-center rounded-xl bg-sky text-brand-800"><Icon className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-sm font-semibold text-brand-900">
            {r.equipment.assetTag} <span className="font-normal text-brand-900/55">{r.equipment.library.shortName}</span> <Badge tone={st.tone}>{st.label}</Badge>
          </div>
          <div className="text-sm text-brand-900/75">
            <Link href={`/admin/istifadeciler/${r.userId}`} className="hover:underline">{r.user.name ?? r.user.email}</Link> · {fmtRange(r.startAt, r.endAt)}
            {r.extendedMinutes ? <span className="text-brand-900/50"> (+{r.extendedMinutes} dəq uzadılıb)</span> : null}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">{children}</div>
      </li>
    );
  };

  return (
    <div>
      <PageHeader title="Avadanlıq masası" subtitle={`Noutbuk və adapterlərin təhvil verilməsi və qəbulu. Götürülməyən rezerv ${rules.equipmentPickupGraceMinutes} dəq sonra ləğv olunur; ${rules.equipmentReturnGraceMinutes} dəqiqədən çox gecikmə avtomatik blokdur.`} />
      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          {overdue.length > 0 && (
            <section>
              <SectionTitle><span className="inline-flex items-center gap-2 text-danger"><TriangleAlert className="size-5" /> Qaytarılmayıb ({overdue.length})</span></SectionTitle>
              <Card className="divide-y divide-brand-100 ring-1 ring-danger/20">
                <ul className="divide-y divide-brand-100">
                  {overdue.map((r) => (
                    <Row key={r.id} r={r}>
                      <span className="text-xs text-danger">{fmtRelative(r.endAt)}</span>
                      <ReturnForm id={r.id} />
                    </Row>
                  ))}
                </ul>
              </Card>
            </section>
          )}
          <section>
            <SectionTitle><span className="inline-flex items-center gap-2"><PackageOpen className="size-5 text-brand-500" /> İstifadədə ({inUse.length})</span></SectionTitle>
            {inUse.length === 0 ? <EmptyState title="Hazırda təhvildə avadanlıq yoxdur" /> : (
              <Card><ul className="divide-y divide-brand-100">
                {inUse.map((r) => (
                  <Row key={r.id} r={r}>
                    <span className={`text-xs font-semibold tabular-nums ${r.endAt.getTime() < now ? "text-danger" : "text-brand-900/60"}`}>
                      <Countdown target={r.endAt.getTime()} prefix="qalıb " doneText="vaxt bitib" />
                    </span>
                    <ReturnForm id={r.id} />
                  </Row>
                ))}
              </ul></Card>
            )}
          </section>
          <section>
            <SectionTitle><span className="inline-flex items-center gap-2"><PackageCheck className="size-5 text-brand-500" /> Bu gün təhvil veriləcək ({toIssue.length})</span></SectionTitle>
            {toIssue.length === 0 ? <EmptyState title="Gözləyən rezerv yoxdur" /> : (
              <Card><ul className="divide-y divide-brand-100">
                {toIssue.map((r) => (
                  <Row key={r.id} r={r}>
                    <form action={adminCancelEquipmentAction}><input type="hidden" name="id" value={r.id} /><ConfirmSubmit question="Ləğv?" confirmText="Bəli">Ləğv</ConfirmSubmit></form>
                    <form action={issueEquipmentAction}><input type="hidden" name="id" value={r.id} /><SubmitButton size="sm">Təhvil ver</SubmitButton></form>
                  </Row>
                ))}
              </ul></Card>
            )}
          </section>
          {done.length > 0 && (
            <section>
              <SectionTitle>Bu günün tarixçəsi</SectionTitle>
              <Card><ul className="divide-y divide-brand-100">{done.map((r) => <Row key={r.id} r={r}>{r.returnedAt && <span className="text-xs text-brand-900/55">qaytarıldı {fmtTime(r.returnedAt)}</span>}</Row>)}</ul></Card>
            </section>
          )}
        </div>
        <aside>
          <Card className="p-5 xl:sticky xl:top-24">
            <div className="mb-3 font-semibold text-brand-900">Masada rezerv (əməkdaş vasitəsilə)</div>
            <DeskReserveForm
              equipment={allEq.map((e) => ({ id: e.id, type: e.type, label: `${e.assetTag} · ${e.name} (${e.library.shortName})` }))}
              defaultStart={defaultStart}
              maxLaptop={rules.laptopMaxMinutes}
              maxAdapter={rules.adapterMaxMinutes}
            />
          </Card>
        </aside>
      </div>
    </div>
  );
}

function ReturnForm({ id }: { id: string }) {
  return (
    <details className="relative">
      <summary className="list-none"><span className="inline-flex h-9 cursor-pointer items-center rounded-xl bg-brand-500 px-3.5 text-[13px] font-semibold text-white hover:bg-brand-600">Qəbul et</span></summary>
      <form action={returnEquipmentAction} className="absolute right-0 z-20 mt-2 w-72 space-y-2 rounded-2xl border border-brand-100 bg-white p-3 shadow-lift">
        <input type="hidden" name="id" value={id} />
        <input name="note" placeholder="Vəziyyət qeydi (istəyə bağlı)" className="field-input text-sm" />
        <label className="flex items-center gap-2 text-sm text-danger"><input type="checkbox" name="damaged" value="1" className="accent-danger" /> Zədəli / natamam qaytarılıb (blok)</label>
        <SubmitButton size="sm" className="w-full">Qəbulu təsdiqlə</SubmitButton>
      </form>
    </details>
  );
}
