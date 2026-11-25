"use client";

import { useActionState, useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { BellRing, Building2, ChevronDown, Info, Loader2, QrCode, Users, Wrench } from "lucide-react";
import { createReservationAction, type FormState } from "@/app/actions/reservations";
import type { RoomAvailability } from "@/lib/booking-data";
import { endOptions } from "@/lib/rules";
import { MONTHS, WEEKDAYS_SHORT, dayKey, fmtDay, fmtDuration, fmtTime, isoWeekday } from "@/lib/time";
import type { BusyBlock } from "@/lib/availability";
import { SubmitButton } from "../submit-button";
import { DayTimeline } from "../timeline";
import { Alert, Badge, btn, cx } from "../ui";
import { WaitlistForm } from "../waitlist-form";
import { InviteField, type InviteStatus } from "./invite-field";
import { Chip, Step } from "./step";

export type LibraryCard = { slug: string; name: string; shortName: string; building: string; cover: string | null; rooms: number; faculty: string | null };
type Cat = 1 | 2 | 3 | 4;

export function DayChips({ days, value, onChange }: { days: string[]; value: string | null; onChange: (d: string) => void }) {
  const today = dayKey(new Date());
  return (
    <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
      {days.map((d) => {
        const [, m, dd] = d.split("-").map(Number);
        const active = d === value;
        return (
          <button key={d} type="button" onClick={() => onChange(d)} aria-pressed={active}
            className={cx("flex min-w-[64px] shrink-0 flex-col items-center rounded-2xl border px-3 py-1.5 transition", active ? "border-brand-500 bg-brand-500 text-white shadow-md" : "border-brand-100 bg-white text-brand-900 hover:border-brand-300")}>
            <span className={cx("text-[11px] font-medium", active ? "text-white/80" : "text-brand-900/55")}>{d === today ? "Bu gün" : WEEKDAYS_SHORT[isoWeekday(d) - 1]}</span>
            <span className="text-lg leading-tight font-semibold">{dd}</span>
            <span className={cx("text-[11px]", active ? "text-white/80" : "text-brand-900/55")}>{MONTHS[m - 1].slice(0, 3)}</span>
          </button>
        );
      })}
    </div>
  );
}

export function LibraryPicker({ libraries, onPick, note }: { libraries: LibraryCard[]; onPick: (slug: string) => void; note?: (l: LibraryCard) => string }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {libraries.map((l) => (
        <button key={l.slug} type="button" onClick={() => onPick(l.slug)} className="group flex items-center gap-3 rounded-2xl border border-brand-100 bg-white p-3 text-left transition hover:border-brand-400 hover:shadow-card">
          <span className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-brand-50">
            {l.cover ? <Image src={l.cover} alt="" fill sizes="64px" className="object-cover" /> : <Building2 className="m-5 size-6 text-brand-300" />}
          </span>
          <span className="min-w-0">
            <span className="block truncate font-semibold text-brand-900 group-hover:text-brand-600">{l.name}</span>
            <span className="block truncate text-xs text-brand-900/60">{l.faculty ?? l.building}</span>
            <span className="mt-1 inline-block rounded-full bg-mint px-2 py-0.5 text-[11px] font-semibold text-brand-900">{note ? note(l) : `${l.rooms} oxu otağı`}</span>
          </span>
        </button>
      ))}
    </div>
  );
}

export function RoomWizard({ libraries, initial, domain, blockedReason }: {
  libraries: LibraryCard[];
  initial: { k?: string; gun?: string; otaq?: string; bas?: number };
  domain: string;
  blockedReason?: string | null;
}) {
  const [state, action] = useActionState<FormState, FormData>(createReservationAction, {});
  const [active, setActive] = useState<number>(initial.k ? 2 : libraries.length === 1 ? 2 : 1);
  const [lib, setLib] = useState<string | null>(initial.k ?? (libraries.length === 1 ? libraries[0].slug : null));
  const [day, setDay] = useState<string | null>(initial.gun ?? null);
  const [data, setData] = useState<RoomAvailability | null>(null);
  const [loading, setLoading] = useState(false);
  const [roomId, setRoomId] = useState<string | null>(null);
  const [cat, setCat] = useState<Cat>(1);
  const [start, setStart] = useState<number | null>(null);
  const [end, setEnd] = useState<number | null>(null);
  const [invites, setInvites] = useState<string[]>(["", "", ""]);
  const [inviteStatus, setInviteStatus] = useState<InviteStatus[]>(["empty", "empty", "empty"]);
  const [headcount, setHeadcount] = useState(4);
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [pendingInitialRoom, setPendingInitialRoom] = useState(initial.otaq ?? null);

  // Məlumatı yüklə
  useEffect(() => {
    if (!lib) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/rezerv/otaqlar?k=${encodeURIComponent(lib)}${day ? `&gun=${day}` : ""}`)
      .then((r) => r.json())
      .then((j: RoomAvailability) => {
        if (cancelled) return;
        setData(j);
        if (j.day !== day) setDay(j.day);
        if (pendingInitialRoom) {
          const r = j.rooms.find((x) => x.slug === pendingInitialRoom);
          if (r) {
            setRoomId(r.id);
            const s = initial.bas && r.starts.find((x) => x.start === initial.bas);
            if (s) setStart(s.start);
            setActive(3);
          }
          setPendingInitialRoom(null);
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lib, day]);

  const libCard = libraries.find((l) => l.slug === lib) ?? null;
  const room = data?.rooms.find((r) => r.id === roomId) ?? null;
  const startObj = room?.starts.find((s) => s.start === start) ?? null;
  const maxFor = (c: Cat) => data?.rules.maxByCategory[c] ?? 60;
  const ends = useMemo(
    () => (startObj && data ? endOptions(startObj.start, startObj.maxEnd, maxFor(cat), data.rules.step, data.rules.minDuration) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [startObj, cat, data],
  );
  const endVal = end && ends.includes(end) ? end : null;
  const needInvites = Math.min(cat, 4) - 1;
  const invitesOk = inviteStatus.slice(0, needInvites).every((s) => s === "found");
  const setStatusAt = useCallback((i: number) => (s: InviteStatus) => setInviteStatus((prev) => (prev[i] === s ? prev : prev.map((x, j) => (j === i ? s : x)))), []);
  const statusSetters = useMemo(() => [0, 1, 2].map((i) => setStatusAt(i)), [setStatusAt]);

  const waitTimes = useMemo(() => {
    if (!room || !data || !day) return [];
    const step = data.rules.step;
    const isToday = day === dayKey(new Date());
    const out: number[] = [];
    const first = room.open;
    for (let t = first; t <= room.close; t += step * 60_000) if (!isToday || t > Date.now()) out.push(t);
    return out;
  }, [room, data, day]);

  const pickLib = (slug: string) => { setLib(slug); setRoomId(null); setStart(null); setEnd(null); setData(null); setActive(2); };
  const pickDay = (d: string) => { setDay(d); setRoomId(null); setStart(null); setEnd(null); };
  const pickRoom = (id: string) => { setRoomId(id); setStart(null); setEnd(null); setShowWaitlist(false); setActive(3); };
  const stepState = (n: number) => (n < active ? "done" : n === active ? "current" : "todo") as "done" | "current" | "todo";
  const lastStep = needInvites > 0 ? 5 : 4;

  if (blockedReason) return <Alert tone="danger" title="Hesabınız bloklanıb">{blockedReason}</Alert>;

  return (
    <div className="space-y-3">

      {/* 1. Kitabxana */}
      <Step n={1} title="Kitabxananı seçin" state={stepState(1)} summary={libCard?.name} onEdit={() => setActive(1)}>
        <LibraryPicker libraries={libraries} onPick={pickLib} />
      </Step>

      {/* 2. Tarix və otaq */}
      <Step n={2} title="Tarix və otaq" state={stepState(2)} summary={room && day ? `${fmtDay(day)} · ${room.name}${room.code ? ` (${room.code})` : ""}` : undefined} onEdit={() => setActive(2)}>
        {!data || loading ? (
          <div className="flex items-center gap-2 py-6 text-sm text-brand-900/60"><Loader2 className="size-4 animate-spin" /> Boş vaxtlar yüklənir…</div>
        ) : !data.days.length ? (
          <Alert tone="warning">Yaxın günlərdə rezerv üçün açıq gün yoxdur.</Alert>
        ) : (
          <div className="space-y-4">
            <DayChips days={data.days} value={day} onChange={pickDay} />
            <div className="grid gap-3">
              {data.rooms.map((r) => {
                const freeMin = r.free.reduce((s, f) => s + (f.end - f.start) / 60000, 0);
                return (
                  <button key={r.id} type="button" onClick={() => pickRoom(r.id)} disabled={r.maintenance}
                    className={cx("grid gap-3 rounded-2xl border p-3 text-left transition sm:grid-cols-[96px_1fr]", r.id === roomId ? "border-brand-500 ring-2 ring-brand-100" : "border-brand-100 hover:border-brand-400", r.maintenance && "cursor-not-allowed opacity-60")}>
                    <span className="relative hidden h-24 overflow-hidden rounded-xl bg-brand-50 sm:block">{r.photos[0] && <Image src={r.photos[0]} alt="" fill sizes="96px" className="object-cover" />}</span>
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-brand-900">{r.name}{r.code && <span className="font-normal text-brand-900/50"> · {r.code}</span>}</span>
                        <Badge tone="neutral"><Users className="size-3" /> {r.capacity}</Badge>
                        {r.maintenance ? <Badge tone="warning"><Wrench className="size-3" /> Təmirdə</Badge> : r.free.length ? <Badge tone="success">Boş: {fmtDuration(Math.round(freeMin))}</Badge> : <Badge tone="warning">Bu gün dolu</Badge>}
                      </span>
                      <span className="mt-2 block"><DayTimeline open={r.open} close={r.close} blocks={r.blocks as BusyBlock[]} compact /></span>
                      <span className="mt-1 flex justify-between text-[10px] text-brand-900/45"><span>{fmtTime(new Date(r.open))}</span><span>{fmtTime(new Date(r.close))}</span></span>
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="flex gap-1.5 text-xs text-brand-900/55"><Info className="mt-0.5 size-3.5 shrink-0" /> Rezervasiyanı ən azı {data.rules.recommendedLead} dəqiqə əvvəl etməyiniz tövsiyə olunur.</p>
          </div>
        )}
      </Step>

      {/* 3. Nəfər və vaxt */}
      <Step n={3} title="Neçə nəfərsiniz və nə vaxt?" state={stepState(3)} summary={startObj && endVal ? `${cat === 4 ? `4+ (${headcount})` : cat} nəfər · ${fmtTime(new Date(startObj.start))}–${fmtTime(new Date(endVal))} · ${fmtDuration(Math.round((endVal - startObj.start) / 60000))}` : undefined} onEdit={() => setActive(3)}>
        {room && data && (
          <div className="space-y-5">
            <div>
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand-900"><Users className="size-4 text-brand-500" /> Nəfər sayı</div>
              <div className="grid grid-cols-4 gap-2">
                {([1, 2, 3, 4] as const).map((c) => (
                  <button key={c} type="button" onClick={() => { setCat(c); setEnd(null); }} aria-pressed={cat === c}
                    className={cx("rounded-xl border px-2 py-2 text-center transition", cat === c ? "border-brand-500 bg-brand-500 text-white" : "border-brand-200 bg-white text-brand-900 hover:border-brand-400")}>
                    <div className="font-semibold">{c === 4 ? "4+" : c}</div>
                    <div className={cx("text-[11px]", cat === c ? "text-white/80" : "text-brand-900/55")}>max {fmtDuration(maxFor(c))}</div>
                  </button>
                ))}
              </div>
              {cat === 4 && (
                <label className="mt-2 flex items-center gap-2 text-sm text-brand-900/75">Ümumi nəfər:
                  <select value={headcount} onChange={(e) => setHeadcount(Number(e.target.value))} className="field-input w-auto py-1.5 text-sm">
                    {Array.from({ length: Math.max(1, room.capacity - 3) }, (_, i) => i + 4).map((n) => <option key={n} value={n}>{n}</option>)}
                  </select>
                </label>
              )}
            </div>
            {room.starts.length === 0 ? (
              <Alert tone="warning" title="Bu otaqda seçilmiş gün boş vaxt yoxdur">Başqa otaq və ya gün seçin, ya da aşağıdan növbəyə yazılın.</Alert>
            ) : (
              <>
                <div>
                  <div className="mb-2 text-sm font-semibold text-brand-900">Başlanğıc</div>
                  <div className="grid max-h-44 grid-cols-4 gap-1.5 overflow-y-auto pr-1 sm:grid-cols-7">
                    {room.starts.map((s, i) => (
                      <Chip key={s.start} active={start === s.start} onClick={() => { setStart(s.start); setEnd(null); }}>
                        {i === 0 && Math.abs(s.start - Date.now()) < 120_000 ? "İndi" : fmtTime(new Date(s.start))}
                      </Chip>
                    ))}
                  </div>
                </div>
                {startObj && (
                  <div>
                    <div className="mb-2 text-sm font-semibold text-brand-900">Bitmə</div>
                    <div className="flex flex-wrap gap-1.5">
                      {ends.map((e) => (
                        <Chip key={e} active={endVal === e} onClick={() => setEnd(e)} plain>
                          {fmtTime(new Date(e))} <span className={endVal === e ? "text-white/75" : "font-normal text-brand-900/45"}>· {fmtDuration(Math.round((e - startObj.start) / 60000))}</span>
                        </Chip>
                      ))}
                    </div>
                    {ends.length > 0 && ends[ends.length - 1] === startObj.maxEnd && (ends[ends.length - 1] - startObj.start) / 60000 < maxFor(cat) && (
                      <p className="mt-2 text-xs text-brand-900/55">Növbəti rezervasiya və ya son rezerv vaxtı səbəbindən maksimum {fmtTime(new Date(startObj.maxEnd))}-a qədər.</p>
                    )}
                  </div>
                )}
              </>
            )}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-brand-100 pt-4">
              <button type="button" onClick={() => setShowWaitlist((v) => !v)} className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700 hover:underline">
                <BellRing className="size-4" /> Uyğun vaxt yoxdur? Boş olarsa məni məlumatlandır <ChevronDown className={cx("size-4 transition", showWaitlist && "rotate-180")} />
              </button>
              <button type="button" disabled={!startObj || !endVal} onClick={() => setActive(4)} className={btn("primary")}>Davam et</button>
            </div>
          </div>
        )}
      </Step>
      {showWaitlist && active === 3 && room && data && waitTimes.length > 1 && (
        <div className="rounded-3xl border border-brand-100 bg-cream/40 p-4 sm:p-5">
          <p className="mb-3 text-sm text-brand-900/70">İstədiyiniz vaxtı seçin. Həmin aralıqda kimsə gəlməsə və ya ləğv etsə, növbədə ilk olaraq sizə bildiriş gedəcək və vaxt {data.rules.waitlistHold} dəqiqə sizin üçün saxlanılacaq.</p>
          <WaitlistForm libraryId={data.library.id} roomId={room.id} roomName={room.name} times={waitTimes} />
        </div>
      )}

      {/* 4. Dəvət (qrup) */}
      {needInvites > 0 && (
        <Step n={4} title="Qrup yoldaşlarınızı dəvət edin" state={stepState(4)} summary={invites.slice(0, needInvites).join(", ")} onEdit={() => setActive(4)}>
          <div className="space-y-3">
            <p className="text-sm text-brand-900/65">{cat === 4 ? "4 və daha çox nəfər üçün 3 nəfəri dəvət etmək kifayətdir." : `${needInvites} nəfəri dəvət edin.`} Tələbə yalnız tam e-poçtu yazdıqda görünür.</p>
            {Array.from({ length: needInvites }, (_, i) => (
              <InviteField
                key={i}
                index={i}
                domain={domain}
                value={invites[i]}
                onChange={(v) => setInvites((prev) => prev.map((x, j) => (j === i ? v : x)))}
                onStatus={statusSetters[i]}
                taken={invites.slice(0, needInvites).filter((_, j) => j !== i).map((x) => x.trim().toLowerCase()).filter(Boolean)}
              />
            ))}
            <div className="flex justify-end"><button type="button" disabled={!invitesOk} onClick={() => setActive(5)} className={btn("primary")}>Davam et</button></div>
          </div>
        </Step>
      )}

      {/* Son addım: təsdiq */}
      <Step n={lastStep} title="Təsdiq" state={stepState(needInvites > 0 ? 5 : 4)}>
        {room && startObj && endVal && day && (
          <form action={action} className="space-y-4">
            <input type="hidden" name="roomId" value={room.id} />
            <input type="hidden" name="start" value={startObj.start} />
            <input type="hidden" name="end" value={endVal} />
            <input type="hidden" name="category" value={cat} />
            {cat === 4 && <input type="hidden" name="headcount" value={headcount} />}
            {invites.slice(0, needInvites).map((v, i) => <input key={i} type="hidden" name="invitees" value={v.trim()} />)}
            {state.error && <Alert tone="danger">{state.error}</Alert>}
            <div className="rounded-2xl bg-brand-900 p-4 text-white">
              <div className="text-xs font-medium tracking-wider text-cream uppercase">Xülasə</div>
              <div className="mt-1 text-lg font-semibold">{room.name}{room.code ? ` · ${room.code}` : ""} · {fmtTime(new Date(startObj.start))}–{fmtTime(new Date(endVal))}</div>
              <div className="text-sm text-white/75">{libCard?.name} · {fmtDay(day)} · {cat === 4 ? `${headcount} nəfər` : `${cat} nəfər`}</div>
              <div className="mt-3 flex gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs text-white/85">
                <QrCode className="size-4 shrink-0 text-cream" /> Başlanğıcda otaqdakı QR kodu {data?.rules.checkInAfter} dəqiqə ərzində skan edin{cat > 1 ? " — hər iştirakçı ayrıca" : ""}. Əks halda rezervasiya ləğv olunur.
              </div>
            </div>
            <input name="purpose" maxLength={300} placeholder="Məqsəd (istəyə bağlı) — məs. kurs işi müzakirəsi" className="field-input text-sm" />
            <label className="flex cursor-pointer items-start gap-3 text-sm text-brand-900">
              <input type="checkbox" name="rulesAccepted" value="1" required className="mt-0.5 size-4.5 accent-brand-500" />
              <span><a href="/qaydalar#oyrenme-otaqlari" target="_blank" className="font-semibold text-brand-600 underline">Kitabxanadan istifadə qaydaları</a> ilə tanış oldum və qəbul edirəm.</span>
            </label>
            <SubmitButton size="lg" className="w-full" pendingText="Rezerv olunur…">Rezervasiyanı təsdiqlə</SubmitButton>
          </form>
        )}
      </Step>
    </div>
  );
}
