"use client";

import { useActionState, useMemo, useState } from "react";
import { Clock, Info, Mail, QrCode, UserPlus, Users } from "lucide-react";
import { createReservationAction, type FormState } from "@/app/actions/reservations";
import { endOptions } from "@/lib/rules";
import { fmtDuration, fmtTime } from "@/lib/time";
import { SubmitButton } from "./submit-button";
import { Alert, cx } from "./ui";

type Start = { start: number; maxEnd: number };

export function RoomBookingForm(props: {
  roomId: string;
  roomName: string;
  dayLabel: string;
  starts: Start[];
  maxByCategory: Record<1 | 2 | 3 | 4, number>;
  stepMinutes: number;
  minDurationMinutes: number;
  checkInAfterMinutes: number;
  capacity: number;
  domain: string;
  initialStart?: number;
  disabledReason?: string | null;
}) {
  const [state, action] = useActionState<FormState, FormData>(createReservationAction, {});
  const [cat, setCat] = useState<1 | 2 | 3 | 4>(1);
  const [start, setStart] = useState<number | null>(
    props.initialStart && props.starts.some((s) => s.start === props.initialStart) ? props.initialStart : props.starts[0]?.start ?? null,
  );
  const startObj = props.starts.find((s) => s.start === start) ?? null;
  const ends = useMemo(
    () => (startObj ? endOptions(startObj.start, startObj.maxEnd, props.maxByCategory[cat], props.stepMinutes, props.minDurationMinutes) : []),
    [startObj, cat, props.maxByCategory, props.stepMinutes, props.minDurationMinutes],
  );
  const [endSel, setEndSel] = useState<number | null>(null);
  const end = endSel && ends.includes(endSel) ? endSel : ends[ends.length - 1] ?? null;
  const invitees = Math.min(cat, 4) - 1;
  const duration = start && end ? Math.round((end - start) / 60000) : 0;
  const limitedByNext = startObj && end && end === startObj.maxEnd && duration < props.maxByCategory[cat];

  if (props.disabledReason) return <Alert tone="danger">{props.disabledReason}</Alert>;
  if (!props.starts.length) {
    return <Alert tone="warning" title="Bu gün boş vaxt qalmayıb">Başqa gün seçin və ya aşağıdakı formadan növbəyə yazılın — vaxt boşalan kimi sizə bildiriş gələcək.</Alert>;
  }

  return (
    <form action={action} className="space-y-6">
      <input type="hidden" name="roomId" value={props.roomId} />
      <input type="hidden" name="start" value={start ?? ""} />
      <input type="hidden" name="end" value={end ?? ""} />
      <input type="hidden" name="category" value={cat} />
      {state.error && <Alert tone="danger">{state.error}</Alert>}

      {/* 1. Nəfər sayı */}
      <fieldset>
        <legend className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-900"><Users className="size-4 text-brand-500" /> Neçə nəfərsiniz?</legend>
        <div className="grid grid-cols-4 gap-2">
          {([1, 2, 3, 4] as const).map((c) => (
            <button
              type="button"
              key={c}
              onClick={() => setCat(c)}
              aria-pressed={cat === c}
              className={cx(
                "rounded-xl border px-2 py-2.5 text-center transition",
                cat === c ? "border-brand-500 bg-brand-500 text-white shadow-md" : "border-brand-200 bg-white text-brand-900 hover:border-brand-400",
              )}
            >
              <div className="text-base font-semibold">{c === 4 ? "4+" : c}</div>
              <div className={cx("text-[11px]", cat === c ? "text-white/80" : "text-brand-900/55")}>max {fmtDuration(props.maxByCategory[c])}</div>
            </button>
          ))}
        </div>
        {cat > 1 && (
          <p className="mt-2 text-xs text-brand-900/60">
            Rezerv vaxtı çatanda bütün iştirakçılar QR kodu skan etməlidir. Skan edənlərin sayı azdırsa, müddət avtomatik qısalır.
          </p>
        )}
      </fieldset>

      {/* 2. Başlanğıc */}
      <fieldset>
        <legend className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-900"><Clock className="size-4 text-brand-500" /> Başlanğıc vaxtı</legend>
        <div className="grid max-h-48 grid-cols-4 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-6">
          {props.starts.map((s, i) => {
            const isNow = i === 0 && Math.abs(s.start - Date.now()) < 120_000;
            return (
              <button
                type="button"
                key={s.start}
                onClick={() => { setStart(s.start); setEndSel(null); }}
                aria-pressed={start === s.start}
                className={cx(
                  "rounded-lg border py-1.5 text-sm font-semibold tabular-nums transition",
                  start === s.start ? "border-brand-500 bg-brand-500 text-white" : "border-brand-100 bg-mint/50 text-brand-900 hover:border-brand-400",
                )}
              >
                {isNow ? "İndi" : fmtTime(new Date(s.start))}
              </button>
            );
          })}
        </div>
      </fieldset>

      {/* 3. Bitmə */}
      {ends.length > 0 && (
        <fieldset>
          <legend className="mb-2 text-sm font-semibold text-brand-900">Bitmə vaxtı</legend>
          <div className="flex flex-wrap gap-1.5">
            {ends.map((e) => (
              <button
                type="button"
                key={e}
                onClick={() => setEndSel(e)}
                aria-pressed={end === e}
                className={cx(
                  "rounded-lg border px-2.5 py-1.5 text-sm tabular-nums transition",
                  end === e ? "border-brand-500 bg-brand-500 font-semibold text-white" : "border-brand-100 bg-white text-brand-900 hover:border-brand-400",
                )}
              >
                {fmtTime(new Date(e))} <span className={end === e ? "text-white/75" : "text-brand-900/45"}>· {fmtDuration(Math.round((e - start!) / 60000))}</span>
              </button>
            ))}
          </div>
          {limitedByNext && (
            <p className="mt-2 text-xs text-brand-900/60">Növbəti rezervasiya və ya iş saatının sonu səbəbindən maksimum {fmtTime(new Date(startObj!.maxEnd))}-a qədər rezerv etmək olar.</p>
          )}
        </fieldset>
      )}

      {/* 4. Dəvət */}
      {invitees > 0 && (
        <fieldset className="rounded-2xl bg-brand-50/70 p-4 ring-1 ring-brand-100">
          <legend className="sr-only">Dəvət</legend>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-brand-900"><UserPlus className="size-4 text-brand-500" /> Qrup yoldaşlarınızı dəvət edin</div>
          <div className="grid gap-2 sm:grid-cols-2">
            {Array.from({ length: invitees }, (_, i) => (
              <div key={`${cat}-${i}`} className="relative">
                <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-brand-300" />
                <input name="invitees" type="email" required placeholder={`${i + 2}-ci nəfər · ad.soyad@${props.domain}`} className="field-input pl-9 text-sm" />
              </div>
            ))}
          </div>
          {cat === 4 && (
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
              <label htmlFor="headcount" className="text-brand-900/75">Ümumi nəfər sayı:</label>
              <select id="headcount" name="headcount" defaultValue="4" className="field-input w-auto py-1.5 text-sm">
                {Array.from({ length: props.capacity - 3 }, (_, i) => i + 4).map((n) => <option key={n} value={n}>{n} nəfər</option>)}
              </select>
              <span className="text-xs text-brand-900/55">4 və daha çox nəfər üçün 3 nəfəri dəvət etmək kifayətdir.</span>
            </div>
          )}
          <p className="mt-3 flex gap-1.5 text-xs text-brand-900/60"><Info className="mt-0.5 size-3.5 shrink-0" /> Dəvət olunanlara bildiriş və e-poçt gedəcək; onlar dəvəti sistemdə qəbul etməlidirlər.</p>
        </fieldset>
      )}

      <div>
        <label htmlFor="purpose" className="mb-1.5 block text-sm font-medium text-brand-900">Məqsəd <span className="font-normal text-brand-900/50">(istəyə bağlı)</span></label>
        <input id="purpose" name="purpose" maxLength={300} placeholder="Məs. Kurs işi üzərində qrup müzakirəsi" className="field-input text-sm" />
      </div>

      {/* Xülasə */}
      {start && end && (
        <div className="rounded-2xl bg-brand-900 p-4 text-white">
          <div className="text-xs font-medium tracking-wider text-cream uppercase">Xülasə</div>
          <div className="mt-1 text-lg font-semibold">{props.roomName} · {fmtTime(new Date(start))}–{fmtTime(new Date(end))}</div>
          <div className="text-sm text-white/75">{props.dayLabel} · {fmtDuration(duration)} · {cat === 4 ? "4+ nəfər" : `${cat} nəfər`}</div>
          <div className="mt-3 flex gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs text-white/85">
            <QrCode className="size-4 shrink-0 text-cream" />
            Başlanğıcda otaqdakı QR kodu {props.checkInAfterMinutes} dəqiqə ərzində skan edin — əks halda rezervasiya ləğv olunur və xəbərdarlıq yazılır.
          </div>
        </div>
      )}

      <label className="flex cursor-pointer items-start gap-3 text-sm text-brand-900">
        <input type="checkbox" name="rulesAccepted" value="1" required className="mt-0.5 size-4.5 accent-brand-500" />
        <span>
          <a href="/qaydalar#oyrenme-otaqlari" target="_blank" className="font-semibold text-brand-600 underline">Kitabxanadan istifadə qaydaları</a> ilə tanış oldum və qəbul edirəm.
        </span>
      </label>

      <SubmitButton size="lg" className="w-full" disabled={!start || !end} pendingText="Rezerv olunur…">Rezervasiyanı təsdiqlə</SubmitButton>
    </form>
  );
}
