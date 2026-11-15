"use client";

import { useActionState, useMemo, useState } from "react";
import { Clock, MapPin } from "lucide-react";
import { createEquipmentAction } from "@/app/actions/equipment";
import type { FormState } from "@/app/actions/reservations";
import { endOptions } from "@/lib/rules";
import { fmtDuration, fmtTime } from "@/lib/time";
import { SubmitButton } from "./submit-button";
import { Alert, cx } from "./ui";

export function EquipmentBookingForm(props: {
  equipmentId: string; label: string; dayLabel: string; starts: { start: number; maxEnd: number }[];
  maxMinutes: number; stepMinutes: number; minDurationMinutes: number; extensionMinutes: number; pickupGrace: number;
  isLaptop: boolean; disabledReason?: string | null;
}) {
  const [state, action] = useActionState<FormState, FormData>(createEquipmentAction, {});
  const [start, setStart] = useState<number | null>(props.starts[0]?.start ?? null);
  const startObj = props.starts.find((s) => s.start === start) ?? null;
  const ends = useMemo(() => (startObj ? endOptions(startObj.start, startObj.maxEnd, props.maxMinutes, props.stepMinutes, props.minDurationMinutes) : []), [startObj, props.maxMinutes, props.stepMinutes, props.minDurationMinutes]);
  const [endSel, setEndSel] = useState<number | null>(null);
  const end = endSel && ends.includes(endSel) ? endSel : ends[ends.length - 1] ?? null;

  if (props.disabledReason) return <Alert tone="danger">{props.disabledReason}</Alert>;
  if (!props.starts.length) return <Alert tone="warning" title="Bu gün boş vaxt yoxdur">Başqa gün və ya eyni tipli digər avadanlığı seçin.</Alert>;

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="equipmentId" value={props.equipmentId} />
      <input type="hidden" name="start" value={start ?? ""} />
      <input type="hidden" name="end" value={end ?? ""} />
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <fieldset>
        <legend className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-900"><Clock className="size-4 text-brand-500" /> Başlanğıc vaxtı</legend>
        <div className="grid max-h-48 grid-cols-4 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-6">
          {props.starts.map((s, i) => (
            <button type="button" key={s.start} onClick={() => { setStart(s.start); setEndSel(null); }} aria-pressed={start === s.start}
              className={cx("rounded-lg border py-1.5 text-sm font-semibold tabular-nums", start === s.start ? "border-brand-500 bg-brand-500 text-white" : "border-brand-100 bg-mint/50 text-brand-900 hover:border-brand-400")}>
              {i === 0 && Math.abs(s.start - Date.now()) < 120_000 ? "İndi" : fmtTime(new Date(s.start))}
            </button>
          ))}
        </div>
      </fieldset>
      {ends.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-brand-900">Qaytarma vaxtı</legend>
          <div className="flex flex-wrap gap-1.5">
            {ends.map((e) => (
              <button type="button" key={e} onClick={() => setEndSel(e)} aria-pressed={end === e}
                className={cx("rounded-lg border px-2.5 py-1.5 text-sm tabular-nums", end === e ? "border-brand-500 bg-brand-500 font-semibold text-white" : "border-brand-100 bg-white text-brand-900 hover:border-brand-400")}>
                {fmtTime(new Date(e))} <span className={end === e ? "text-white/75" : "text-brand-900/45"}>· {fmtDuration(Math.round((e - start!) / 60000))}</span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-brand-900/60">Maksimum {fmtDuration(props.maxMinutes)}. Başqası rezerv etməyibsə, istifadə zamanı bir dəfə {fmtDuration(props.extensionMinutes)}-a qədər uzada bilərsiniz.</p>
        </fieldset>
      )}
      {start && end && (
        <div className="rounded-2xl bg-brand-900 p-4 text-white">
          <div className="text-xs font-medium tracking-wider text-cream uppercase">Xülasə</div>
          <div className="mt-1 text-lg font-semibold">{props.label} · {fmtTime(new Date(start))}–{fmtTime(new Date(end))}</div>
          <div className="text-sm text-white/75">{props.dayLabel} · {fmtDuration(Math.round((end - start) / 60000))}</div>
          <ul className="mt-3 space-y-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs text-white/85">
            <li>• Avadanlığı kitabxana əməkdaşından təhvil alın — {props.pickupGrace} dəqiqə ərzində götürülməsə rezerv ləğv olunur.</li>
            {props.isLaptop && <li className="flex gap-1"><MapPin className="size-3.5 shrink-0 text-cream" /> Noutbuk yalnız oxu zalında istifadə olunur, kitabxana ərazisindən çıxarıla bilməz.</li>}
            <li>• Vaxtında qaytarılmama hesabın avtomatik bloklanmasına səbəb olur.</li>
          </ul>
        </div>
      )}
      <label className="flex cursor-pointer items-start gap-3 text-sm text-brand-900">
        <input type="checkbox" name="rulesAccepted" value="1" required className="mt-0.5 size-4.5 accent-brand-500" />
        <span><a href="/qaydalar#komputer-noutbuk" target="_blank" className="font-semibold text-brand-600 underline">Avadanlıqdan istifadə qaydaları</a> ilə tanış oldum, avadanlığı təhvil aldığım vəziyyətdə qaytarmağı öhdəmə götürürəm.</span>
      </label>
      <SubmitButton size="lg" className="w-full" disabled={!start || !end} pendingText="Rezerv olunur…">Rezervasiyanı təsdiqlə</SubmitButton>
    </form>
  );
}
