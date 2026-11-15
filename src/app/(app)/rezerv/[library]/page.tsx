import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarX2, DoorOpen, Laptop, Plug, Users } from "lucide-react";
import { DayPicker } from "@/components/day-picker";
import { DayTimeline, TimelineLegend } from "@/components/timeline";
import { Alert, Badge, Card, EmptyState, LinkButton, PageHeader, cx } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { closedDaysFor, equipmentDay, roomDay } from "@/lib/availability";
import { db } from "@/lib/db";
import { EQUIPMENT_LABELS } from "@/lib/equipment";
import { bookableDays } from "@/lib/rules";
import { getRules } from "@/lib/settings";
import { runSweep } from "@/lib/sweep";
import { fmtDay, fmtDuration, fmtTime, hhmm, isValidDayKey } from "@/lib/time";

type Props = { params: Promise<{ library: string }>; searchParams: Promise<{ gun?: string; bolme?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { library } = await params;
  const lib = await db.library.findUnique({ where: { slug: library }, select: { name: true } });
  return { title: lib?.name ?? "Kitabxana" };
}

export default async function LibraryPage({ params, searchParams }: Props) {
  const { library } = await params;
  const sp = await searchParams;
  const user = await requireUser({ next: `/rezerv/${library}` });
  await runSweep();
  const lib = await db.library.findUnique({
    where: { slug: library },
    include: {
      rooms: { where: { isActive: true }, orderBy: { sortOrder: "asc" }, include: { photos: { orderBy: { sortOrder: "asc" }, take: 1 } } },
      equipment: { where: { isActive: true }, orderBy: [{ type: "asc" }, { sortOrder: "asc" }] },
    },
  });
  if (!lib || !lib.isActive) notFound();
  const rules = await getRules();
  const closed = await closedDaysFor(lib.id);
  const days = bookableDays(new Date(), lib, rules.maxAdvanceDays, closed);
  const day = isValidDayKey(sp.gun) && days.includes(sp.gun) ? sp.gun : days[0];
  const tab = sp.bolme === "avadanliq" ? "avadanliq" : "otaqlar";
  const href = (d: string, t = tab) => `/rezerv/${lib.slug}?gun=${d}&bolme=${t}`;

  const roomDays = day ? await Promise.all(lib.rooms.map((r) => roomDay(r.id, lib, day, user.id))) : [];
  const eqDays = day && tab === "avadanliq" ? await Promise.all(lib.equipment.map((e) => equipmentDay(e.id, lib, day, user.id))) : [];

  return (
    <div>
      <Link href="/rezerv" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
        <ArrowLeft className="size-4" /> Kitabxanalar
      </Link>
      <PageHeader
        eyebrow={lib.building}
        title={lib.name}
        subtitle={`İş saatları: B.e.–Cümə, ${hhmm(lib.openMinute)}–${hhmm(lib.closeMinute)}. Rezervasiyanı ən azı ${rules.recommendedLeadMinutes} dəqiqə əvvəl etməyiniz tövsiyə olunur.`}
      />

      {user.blockedAt && (
        <Alert tone="danger" className="mb-5" title="Hesabınız bloklanıb">
          {user.blockedReason}. Yeni rezervasiya etmək üçün kitabxana əməkdaşına müraciət edin.
        </Alert>
      )}

      <div className="mb-5 inline-flex rounded-2xl bg-white p-1 shadow-card ring-1 ring-brand-100" role="tablist">
        {[
          ["otaqlar", "Oxu otaqları", DoorOpen, lib.rooms.length],
          ["avadanliq", "Noutbuk və adapterlər", Laptop, lib.equipment.length],
        ].map(([key, label, Icon, n]) => {
          const I = Icon as typeof DoorOpen;
          return (
            <Link
              key={key as string}
              role="tab"
              aria-selected={tab === key}
              href={href(day ?? "", key as string)}
              scroll={false}
              className={cx("inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition", tab === key ? "bg-brand-500 text-white" : "text-brand-800 hover:bg-brand-50")}
            >
              <I className="size-4" /> {label as string}
              <span className={cx("rounded-full px-1.5 text-xs", tab === key ? "bg-white/20" : "bg-brand-50")}>{n as number}</span>
            </Link>
          );
        })}
      </div>

      {!day ? (
        <EmptyState icon={<CalendarX2 />} title="Yaxın günlərdə rezerv üçün açıq gün yoxdur" text="Kitabxana bağlıdır və ya iş saatı bitib." />
      ) : (
        <>
          <div className="mb-5">
            <DayPicker days={days} selected={day} hrefFor={(d) => href(d)} />
          </div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-[17px] font-semibold text-brand-900">{fmtDay(day)}</h2>
            <TimelineLegend withHold={tab === "otaqlar"} />
          </div>

          {tab === "otaqlar" ? (
            lib.rooms.length === 0 ? (
              <EmptyState icon={<DoorOpen />} title="Bu kitabxanada hələ otaq yoxdur" />
            ) : (
              <div className="space-y-4">
                {lib.rooms.map((room, i) => {
                  const rd = roomDays[i];
                  const freeMin = rd.free.reduce((s, f) => s + (f.end - f.start) / 60000, 0);
                  const roomHref = `/rezerv/${lib.slug}/otaq/${room.slug}?gun=${day}`;
                  return (
                    <Card key={room.id} className="overflow-hidden">
                      <div className="grid gap-0 sm:grid-cols-[180px_1fr]">
                        <Link href={roomHref} className="relative block h-40 sm:h-full">
                          {room.photos[0] ? (
                            <Image src={room.photos[0].url} alt={room.photos[0].alt ?? room.name} fill sizes="180px" className="object-cover" />
                          ) : (
                            <div className="grid h-full place-items-center bg-brand-50 text-brand-300"><DoorOpen className="size-10" /></div>
                          )}
                        </Link>
                        <div className="p-4 sm:p-5">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div>
                              <Link href={roomHref} className="text-lg font-semibold text-brand-900 hover:underline">
                                {room.name} {room.code && <span className="font-medium text-brand-900/50">· {room.code}</span>}
                              </Link>
                              <div className="mt-1 flex flex-wrap gap-2">
                                <Badge tone="neutral"><Users className="size-3.5" /> {room.capacity} nəfərə qədər</Badge>
                                {rd.free.length ? (
                                  <Badge tone="success">Boş: {fmtDuration(Math.round(freeMin))}</Badge>
                                ) : (
                                  <Badge tone="warning">Bu gün boş vaxt yoxdur</Badge>
                                )}
                              </div>
                            </div>
                            <LinkButton href={roomHref} size="sm" variant={rd.free.length ? "primary" : "secondary"}>
                              {rd.free.length ? "Vaxt seç" : "Növbəyə yazıl"}
                            </LinkButton>
                          </div>
                          <div className="mt-4">
                            <DayTimeline open={rd.open} close={rd.close} blocks={rd.blocks} />
                          </div>
                          {rd.free.length > 0 && (
                            <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                              <span className="text-brand-900/55">Boş aralıqlar:</span>
                              {rd.free.map((f) => (
                                <Link
                                  key={f.start}
                                  href={`${roomHref}&bas=${f.start}`}
                                  className="rounded-lg bg-mint px-2 py-0.5 font-semibold text-brand-900 hover:bg-brand-500 hover:text-white"
                                >
                                  {fmtTime(new Date(f.start))}–{fmtTime(new Date(f.end))}
                                </Link>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )
          ) : lib.equipment.length === 0 ? (
            <EmptyState icon={<Laptop />} title="Bu kitabxanada rezerv olunan avadanlıq yoxdur" text="Noutbuk və adapterlər hazırda Əsas bina kitabxanasında təqdim olunur." action={<LinkButton href="/rezerv" variant="secondary" size="sm">Kitabxanalar</LinkButton>} />
          ) : (
            <div className="space-y-8">
              {(["LAPTOP", "ADAPTER"] as const).map((type) => {
                const items = lib.equipment.map((e, i) => ({ e, d: eqDays[i] })).filter((x) => x.e.type === type);
                if (!items.length) return null;
                const max = type === "LAPTOP" ? rules.laptopMaxMinutes : rules.adapterMaxMinutes;
                return (
                  <section key={type}>
                    <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="flex items-center gap-2 font-semibold text-brand-900">
                        {type === "LAPTOP" ? <Laptop className="size-5 text-brand-500" /> : <Plug className="size-5 text-brand-500" />}
                        {EQUIPMENT_LABELS[type].many}
                      </h3>
                      <span className="text-xs text-brand-900/55">
                        Maksimum {fmtDuration(max)} · bir dəfə {rules.equipmentExtensionPercent}% uzatma{type === "LAPTOP" ? " · yalnız oxu zalında" : ""}
                      </span>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map(({ e, d }) => {
                        const itemHref = `/rezerv/${lib.slug}/avadanliq/${e.assetTag.toLowerCase()}?gun=${day}`;
                        return (
                          <Card key={e.id} className="overflow-hidden">
                            <Link href={itemHref} className="flex items-center gap-3 p-3">
                              <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-brand-50">
                                {e.photoUrl && <Image src={e.photoUrl} alt="" fill sizes="64px" className="object-cover" />}
                              </div>
                              <div className="min-w-0">
                                <div className="font-semibold text-brand-900">{e.name}</div>
                                <div className="text-xs font-semibold tracking-wide text-brand-500">ID: {e.assetTag}</div>
                                <div className="mt-1">
                                  {d.free.length ? <Badge tone="success">Boş vaxt var</Badge> : <Badge tone="warning">Bu gün dolu</Badge>}
                                </div>
                              </div>
                            </Link>
                            <div className="px-3 pb-3">
                              <DayTimeline open={d.open} close={d.close} blocks={d.blocks} compact />
                              <div className="mt-1 flex justify-between text-[10px] text-brand-900/45">
                                <span>{hhmm(lib.openMinute)}</span><span>{hhmm(lib.closeMinute)}</span>
                              </div>
                              <LinkButton href={itemHref} size="sm" variant={d.free.length ? "primary" : "secondary"} className="mt-2 w-full">
                                {d.free.length ? "Rezerv et" : "Ətraflı"}
                              </LinkButton>
                            </div>
                          </Card>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
