"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Laptop, Loader2, MapPin, Plug, Wrench } from "lucide-react";
import { createEquipmentAction } from "@/app/actions/equipment";
import type { FormState } from "@/app/actions/reservations";
import type { BusyBlock } from "@/lib/availability";
import type { EquipmentAvailability } from "@/lib/booking-data";
import { endOptions } from "@/lib/rules";
import { fmtDay, fmtDuration, fmtTime } from "@/lib/time";
import { SubmitButton } from "../submit-button";
import { DayTimeline } from "../timeline";
import { Alert, Badge, btn, cx } from "../ui";
import { DayChips, LibraryPicker, type LibraryCard } from "./room-wizard";
import { Chip, Step } from "./step";

type EqLib = LibraryCard & { laptops: number; adapters: number };

export function EquipmentWizard({ libraries, initial, blockedReason }: {
  libraries: EqLib[]; initial: { k?: string; item?: string; gun?: string; nov?: "LAPTOP" | "ADAPTER" }; blockedReason?: string | null;
}) {
  const [state, action] = useActionState<FormState, FormData>(createEquipmentAction, {});
  const single = libraries.length === 1 ? libraries[0].slug : null;
  const [lib, setLib] = useState<string | null>(initial.k ?? single);
  const libCard = libraries.find((l) => l.slug === lib) ?? null;
  const [type, setType] = useState<"LAPTOP" | "ADAPTER">(initial.nov ?? (initial.item?.startsWith("ad") ? "ADAPTER" : libCard && !libCard.laptops ? "ADAPTER" : "LAPTOP"));
  const [day, setDay] = useState<string | null>(initial.gun ?? null);
  const [active, setActive] = useState(lib ? 2 : 1);
  const [data, setData] = useState<EquipmentAvailability | null>(null);
  const [loading, setLoading] = useState(false);
  const [itemId, setItemId] = useState<string | null>(null);
  const [start, setStart] = useState<number | null>(null);
  const [end, setEnd] = useState<number | null>(null);
  const [pendingItem, setPendingItem] = useState(initial.item ?? null);

  useEffect(() => {
    if (!lib) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/rezerv/avadanliq?k=${encodeURIComponent(lib)}&nov=${type}${day ? `&gun=${day}` : ""}`)
      .then((r) => r.json())
      .then((j: EquipmentAvailability) => {
        if (cancelled) return;
        setData(j);
        if (j.day !== day) setDay(j.day);
        if (pendingItem) {
          const it = j.items.find((x) => x.tag.toLowerCase() === pendingItem.toLowerCase());
          if (it) { setItemId(it.id); setActive(3); }
          setPendingItem(null);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib, day, type]);

  const item = data?.items.find((x) => x.id === itemId) ?? null;
  const startObj = item?.starts.find((s) => s.start === start) ?? null;
  const ends = useMemo(() => (startObj && data ? endOptions(startObj.start, startObj.maxEnd, data.rules.max, data.rules.step, data.rules.minDuration) : []), [startObj, data]);
  const endVal = end && ends.includes(end) ? end : null;
  const st = (n: number) => (n < active ? "done" : n === active ? "current" : "todo") as "done" | "current" | "todo";
  const reset = () => { setItemId(null); setStart(null); setEnd(null); };

  if (blockedReason) return <Alert tone="danger" title="Hesabınız bloklanıb">{blockedReason}</Alert>;
  if (!libraries.length) return <Alert tone="info">Hazırda heç bir kitabxanada rezerv olunan avadanlıq yoxdur.</Alert>;

  return (
    <div className="space-y-3">
      <Step n={1} title="Kitabxananı seçin" state={st(1)} summary={libCard?.name} onEdit={() => setActive(1)}>
        <LibraryPicker libraries={libraries} onPick={(s) => { setLib(s); reset(); setData(null); const l = libraries.find((x) => x.slug === s); if (l && !l.laptops) setType("ADAPTER"); setActive(2); }} note={(l) => {
          const x = l as EqLib;
          return [x.laptops ? `${x.laptops} noutbuk` : null, x.adapters ? `${x.adapters} adapter` : null].filter(Boolean).join(" · ");
        }} />
      </Step>

      <Step n={2} title="Nə lazımdır və hansı gün?" state={st(2)} summary={day ? `${type === "LAPTOP" ? "Noutbuk" : "Adapter"} · ${fmtDay(day)}` : undefined} onEdit={() => setActive(2)}>
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-2">
            {([["LAPTOP", "Noutbuk", Laptop, libCard?.laptops ?? 0], ["ADAPTER", "Adapter", Plug, libCard?.adapters ?? 0]] as const).map(([t, label, Icon, n]) => (
              <button key={t} type="button" disabled={!n} onClick={() => { setType(t); reset(); }} aria-pressed={type === t}
                className={cx("flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 font-semibold transition disabled:opacity-40", type === t ? "border-brand-500 bg-brand-500 text-white" : "border-brand-200 bg-white text-brand-900 hover:border-brand-400")}>
                <Icon className="size-5" /> {label} <span className={cx("text-xs font-medium", type === t ? "text-white/75" : "text-brand-900/50")}>({n})</span>
              </button>
            ))}
          </div>
          {data && data.days.length > 0 ? <DayChips days={data.days} value={day} onChange={(d) => { setDay(d); reset(); }} /> : loading ? null : <Alert tone="warning">Yaxın günlərdə açıq gün yoxdur.</Alert>}
          <div className="flex justify-end"><button type="button" disabled={!day} onClick={() => setActive(3)} className={btn("primary")}>Davam et</button></div>
        </div>
      </Step>

      <Step n={3} title="Avadanlıq və vaxt" state={st(3)} summary={item && startObj && endVal ? `${item.tag} · ${fmtTime(new Date(startObj.start))}–${fmtTime(new Date(endVal))}` : undefined} onEdit={() => setActive(3)}>
        {!data || loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-brand-900/60"><Loader2 className="size-4 animate-spin" /> Yüklənir…</div>
        ) : (
          <div className="space-y-5">
            <div className="grid gap-2 sm:grid-cols-2">
              {data.items.map((it) => (
                <button key={it.id} type="button" disabled={it.maintenance} onClick={() => { setItemId(it.id); setStart(null); setEnd(null); }}
                  className={cx("flex items-center gap-3 rounded-2xl border p-2.5 text-left transition", it.id === itemId ? "border-brand-500 ring-2 ring-brand-100" : "border-brand-100 hover:border-brand-400", it.maintenance && "cursor-not-allowed opacity-55")}>
                  <span className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-brand-50">{it.photo && <Image src={it.photo} alt="" fill sizes="56px" className="object-cover" />}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2"><span className="font-semibold text-brand-900">{it.tag}</span>{it.maintenance ? <Badge tone="warning"><Wrench className="size-3" /> Təmirdə</Badge> : it.starts.length ? <Badge tone="success">Boş vaxt var</Badge> : <Badge tone="warning">Dolu</Badge>}</span>
                    <span className="mt-1.5 block"><DayTimeline open={it.open} close={it.close} blocks={it.blocks as BusyBlock[]} compact /></span>
                  </span>
                </button>
              ))}
            </div>
            {item && (item.starts.length === 0 ? <Alert tone="warning">Bu avadanlıq seçilmiş gün doludur — başqasını seçin.</Alert> : (
              <>
                <div>
                  <div className="mb-2 text-sm font-semibold text-brand-900">Başlanğıc</div>
                  <div className="grid max-h-44 grid-cols-4 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-7">
                    {item.starts.map((s, i) => (
                      <Chip key={s.start} active={start === s.start} onClick={() => { setStart(s.start); setEnd(null); }}>{i === 0 && Math.abs(s.start - Date.now()) < 120_000 ? "İndi" : fmtTime(new Date(s.start))}</Chip>
                    ))}
                  </div>
                </div>
                {startObj && (
                  <div>
                    <div className="mb-2 text-sm font-semibold text-brand-900">Qaytarma vaxtı</div>
                    <div className="flex flex-wrap gap-1.5">
                      {ends.map((e) => (
                        <Chip key={e} active={endVal === e} onClick={() => setEnd(e)} plain>{fmtTime(new Date(e))} <span className={endVal === e ? "text-white/75" : "font-normal text-brand-900/45"}>· {fmtDuration(Math.round((e - startObj.start) / 60000))}</span></Chip>
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-brand-900/55">Maksimum {fmtDuration(data.rules.max)}. Başqası rezerv etməyibsə istifadə zamanı bir dəfə {fmtDuration(data.rules.extension)}-a qədər uzada bilərsiniz.</p>
                  </div>
                )}
              </>
            ))}
            <div className="flex justify-end"><button type="button" disabled={!startObj || !endVal} onClick={() => setActive(4)} className={btn("primary")}>Davam et</button></div>
          </div>
        )}
      </Step>

      <Step n={4} title="Təsdiq" state={st(4)}>
        {item && startObj && endVal && day && data && (
          <form action={action} className="space-y-4">
            <input type="hidden" name="equipmentId" value={item.id} />
            <input type="hidden" name="start" value={startObj.start} />
            <input type="hidden" name="end" value={endVal} />
            {state.error && <Alert tone="danger">{state.error}</Alert>}
            <div className="rounded-2xl bg-brand-900 p-4 text-white">
              <div className="text-xs font-medium tracking-wider text-cream uppercase">Xülasə</div>
              <div className="mt-1 text-lg font-semibold">{item.name} ({item.tag}) · {fmtTime(new Date(startObj.start))}–{fmtTime(new Date(endVal))}</div>
              <div className="text-sm text-white/75">{libCard?.name} · {fmtDay(day)}</div>
              <ul className="mt-3 space-y-1.5 rounded-xl bg-white/10 px-3 py-2 text-xs text-white/85">
                <li>• Avadanlığı kitabxana əməkdaşından təhvil alın — {data.rules.pickupGrace} dəqiqə ərzində götürülməsə rezerv ləğv olunur.</li>
                {type === "LAPTOP" && <li className="flex gap-1"><MapPin className="size-3.5 shrink-0 text-cream" /> Noutbuk yalnız oxu zalında istifadə olunur, kitabxana ərazisindən çıxarıla bilməz.</li>}
                <li>• Vaxtında qaytarılmama hesabın avtomatik bloklanmasına səbəb olur.</li>
              </ul>
            </div>
            <label className="flex cursor-pointer items-start gap-3 text-sm text-brand-900">
              <input type="checkbox" name="rulesAccepted" value="1" required className="mt-0.5 size-4.5 accent-brand-500" />
              <span><a href="/qaydalar#komputer-noutbuk" target="_blank" className="font-semibold text-brand-600 underline">Avadanlıqdan istifadə qaydaları</a> ilə tanış oldum, avadanlığı təhvil aldığım vəziyyətdə qaytarmağı öhdəmə götürürəm.</span>
            </label>
            <SubmitButton size="lg" className="w-full" pendingText="Rezerv olunur…">Rezervasiyanı təsdiqlə</SubmitButton>
          </form>
        )}
      </Step>
    </div>
  );
}
