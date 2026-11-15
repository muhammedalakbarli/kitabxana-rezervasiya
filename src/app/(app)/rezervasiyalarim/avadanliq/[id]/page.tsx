import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Download, MapPin, Timer } from "lucide-react";
import { cancelEquipmentAction, extendEquipmentAction } from "@/app/actions/equipment";
import { Countdown } from "@/components/countdown";
import { ConfirmSubmit, SubmitButton } from "@/components/submit-button";
import { Alert, Badge, Card, KeyValue, SectionTitle, btn } from "@/components/ui";
import { getCurrentUser, isStaff, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { EQUIPMENT_LABELS } from "@/lib/equipment";
import { EQUIPMENT_STATUS } from "@/lib/labels";
import { equipmentExtensionLimit } from "@/lib/rules";
import { getRules } from "@/lib/settings";
import { runSweep } from "@/lib/sweep";
import { dayKey, fmtDateTime, fmtDay, fmtDuration, fmtRange, fmtTime, zoned } from "@/lib/time";

export const metadata: Metadata = { title: "Avadanlıq rezervasiyası" };

export default async function EquipmentReservationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser({ next: `/rezervasiyalarim/avadanliq/${id}` });
  await runSweep();
  const r = await db.equipmentReservation.findUnique({ where: { id }, include: { equipment: { include: { library: true } } } });
  const viewer = await getCurrentUser();
  if (!r || (r.userId !== user.id && !isStaff(viewer))) notFound();
  const rules = await getRules();
  const st = EQUIPMENT_STATUS[r.status];
  const original = Math.round((r.plannedEndAt.getTime() - r.startAt.getTime()) / 60000);
  const limit = equipmentExtensionLimit(original, rules.equipmentExtensionPercent);
  const close = zoned(dayKey(r.startAt), r.equipment.library.closeMinute).getTime();
  const maxByClose = Math.floor((close - r.endAt.getTime()) / 60000);
  const extMax = Math.min(limit, maxByClose);
  const canExtend = r.userId === user.id && ["BOOKED", "ISSUED"].includes(r.status) && r.extendedMinutes === 0 && r.endAt.getTime() > Date.now() && extMax >= 15;
  const opts: number[] = [];
  for (let m = 15; m <= extMax; m += 15) opts.push(m);
  if (extMax >= 15 && !opts.includes(extMax)) opts.push(extMax);

  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/rezervasiyalarim" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"><ArrowLeft className="size-4" /> Rezervasiyalarım</Link>
      <div className="grid gap-6 md:grid-cols-[300px_1fr]">
        <Card className="h-fit overflow-hidden">
          <div className="relative aspect-[4/3] bg-brand-50">{r.equipment.photoUrl && <Image src={r.equipment.photoUrl} alt="" fill sizes="300px" className="object-cover" />}</div>
          <div className="p-5">
            <div className="text-xs font-semibold tracking-wider text-brand-500 uppercase">{EQUIPMENT_LABELS[r.equipment.type].one}</div>
            <div className="mt-1 text-xl font-semibold text-brand-900">{r.equipment.name}</div>
            <Badge tone="cream" className="mt-2">ID: {r.equipment.assetTag}</Badge>
            <p className="mt-3 flex gap-1.5 text-sm text-brand-900/65"><MapPin className="mt-0.5 size-4 shrink-0" /> {r.equipment.library.name}</p>
          </div>
        </Card>
        <div className="space-y-5">
          <Card className="p-5 sm:p-6">
            <Badge tone={st.tone}>{st.label}</Badge>
            <h1 className="mt-2 text-2xl font-semibold text-brand-900">{fmtRange(r.startAt, r.endAt)}</h1>
            <div className="text-brand-900/65">{fmtDay(dayKey(r.startAt))} · {fmtDuration(Math.round((r.endAt.getTime() - r.startAt.getTime()) / 60000))}</div>
            {r.status === "ISSUED" && (
              <div className="mt-4 flex items-center gap-3 rounded-2xl bg-mint/60 p-4">
                <Timer className="size-6 text-brand-700" />
                <div>
                  <div className="text-sm text-brand-900/70">Qaytarmağa qalan vaxt</div>
                  <Countdown target={r.endAt.getTime()} className="text-xl font-semibold tabular-nums text-brand-900" doneText="Vaxt bitib — dərhal qaytarın" />
                </div>
              </div>
            )}
            {r.status === "BOOKED" && <Alert tone="info" className="mt-4">Avadanlığı {fmtTime(r.startAt)}-dan etibarən kitabxana əməkdaşından təhvil alın. {rules.equipmentPickupGraceMinutes} dəqiqə ərzində götürülməsə rezerv avtomatik ləğv olunur.</Alert>}
            {r.status === "OVERDUE" && <Alert tone="danger" className="mt-4" title="Avadanlıq vaxtında qaytarılmayıb">Hesabınız bloklanıb. Avadanlığı dərhal kitabxanaya qaytarın.</Alert>}
            {r.equipment.type === "LAPTOP" && ["BOOKED", "ISSUED"].includes(r.status) && <p className="mt-3 text-xs text-brand-900/60">Noutbuk yalnız oxu zalında istifadə olunur və kitabxana ərazisindən çıxarıla bilməz.</p>}
          </Card>

          {r.userId === user.id && ["BOOKED", "ISSUED"].includes(r.status) && (
            <Card className="p-5 sm:p-6">
              <SectionTitle>Müddəti uzat</SectionTitle>
              {r.extendedMinutes > 0 ? (
                <p className="text-sm text-brand-900/65">Müddət artıq bir dəfə {r.extendedMinutes} dəqiqə uzadılıb. Yenidən uzatmaq mümkün deyil.</p>
              ) : canExtend ? (
                <form action={extendEquipmentAction} className="flex flex-wrap items-end gap-3">
                  <input type="hidden" name="id" value={r.id} />
                  <label className="text-sm">
                    <span className="mb-1 block font-medium text-brand-900">Əlavə müddət</span>
                    <select name="minutes" defaultValue={opts[opts.length - 1]} className="field-input w-auto">
                      {opts.map((m) => <option key={m} value={m}>+{fmtDuration(m)}</option>)}
                    </select>
                  </label>
                  <SubmitButton pendingText="Yoxlanılır…">Uzat</SubmitButton>
                  <p className="w-full text-xs text-brand-900/55">Yalnız bir dəfə, maksimum {fmtDuration(limit)} (ilkin müddətin {rules.equipmentExtensionPercent}%-i). Başqa istifadəçi rezerv edibsə uzatma mümkün olmayacaq.</p>
                </form>
              ) : (
                <p className="text-sm text-brand-900/65">Kitabxananın iş saatı bitdiyi üçün uzatma mümkün deyil.</p>
              )}
            </Card>
          )}

          <Card className="p-5">
            <KeyValue items={[
              ["Rezerv edilib", fmtDateTime(r.createdAt)],
              ["Təhvil verilib", r.issuedAt ? fmtDateTime(r.issuedAt) : "—"],
              ["Qaytarılıb", r.returnedAt ? fmtDateTime(r.returnedAt) : "—"],
              ["Uzatma", r.extendedMinutes ? `+${r.extendedMinutes} dəq` : "—"],
              ...(r.cancelReason ? [["Qeyd", r.cancelReason] as [string, string]] : []),
            ]} />
            {["BOOKED", "ISSUED"].includes(r.status) && (
              <a href={`/api/ics/avadanliq/${r.id}`} className={btn("ghost", "sm", "mt-3")}><Download className="size-4" /> Təqvim faylı (.ics)</a>
            )}
          </Card>

          {r.userId === user.id && r.status === "BOOKED" && (
            <form action={cancelEquipmentAction}>
              <input type="hidden" name="id" value={r.id} />
              <ConfirmSubmit question="Rezervasiya ləğv edilsin?" confirmText="Ləğv et">Rezervasiyanı ləğv et</ConfirmSubmit>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
