import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Users } from "lucide-react";
import { DayPicker } from "@/components/day-picker";
import { PhotoGallery } from "@/components/photo-gallery";
import { RoomBookingForm } from "@/components/room-booking-form";
import { DayTimeline, TimelineLegend } from "@/components/timeline";
import { WaitlistForm } from "@/components/waitlist-form";
import { Badge, Card, EmptyState, SectionTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { closedDaysFor, roomDay } from "@/lib/availability";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { bookableDays, maxMinutesForCategory } from "@/lib/rules";
import { getRules } from "@/lib/settings";
import { runSweep } from "@/lib/sweep";
import { fmtDay, isValidDayKey, minutesOfDay, zoned } from "@/lib/time";

type Props = { params: Promise<{ library: string; room: string }>; searchParams: Promise<{ gun?: string; bas?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { library, room } = await params;
  const r = await db.room.findFirst({ where: { slug: room, library: { slug: library } }, select: { name: true, library: { select: { shortName: true } } } });
  return { title: r ? `${r.name} · ${r.library.shortName}` : "Otaq" };
}

export default async function RoomPage({ params, searchParams }: Props) {
  const { library, room: roomSlug } = await params;
  const sp = await searchParams;
  const user = await requireUser({ next: `/rezerv/${library}/otaq/${roomSlug}` });
  await runSweep();
  const room = await db.room.findFirst({
    where: { slug: roomSlug, library: { slug: library } },
    include: { library: true, photos: { orderBy: { sortOrder: "asc" } } },
  });
  if (!room || !room.isActive || !room.library.isActive) notFound();
  const lib = room.library;
  const rules = await getRules();
  const closed = await closedDaysFor(lib.id);
  const days = bookableDays(new Date(), lib, rules.maxAdvanceDays, closed);
  const day = isValidDayKey(sp.gun) && days.includes(sp.gun) ? sp.gun : days[0];
  const rd = day ? await roomDay(room.id, lib, day, user.id) : null;

  // Növbə üçün vaxt şəbəkəsi
  const times: number[] = [];
  if (rd && day) {
    const step = rules.slotStepMinutes;
    const nowLocal = day === days[0] ? Math.max(lib.openMinute, Math.ceil((minutesOfDay(new Date()) + 1) / step) * step) : lib.openMinute;
    for (let m = nowLocal; m <= lib.closeMinute; m += step) times.push(zoned(day, m).getTime());
  }
  const initialStart = sp.bas ? Number(sp.bas) : undefined;
  const waitStart = initialStart && times.includes(initialStart) ? initialStart : rd?.blocks.find((b) => b.end > Date.now() && b.kind !== "mine")?.start;
  const features = room.features.split("\n").map((s) => s.trim()).filter(Boolean);

  return (
    <div>
      <Link href={`/rezerv/${lib.slug}${day ? `?gun=${day}` : ""}`} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
        <ArrowLeft className="size-4" /> {lib.name}
      </Link>
      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <PhotoGallery photos={room.photos} alt={room.name} />
          <Card className="p-5">
            <div className="text-xs font-semibold tracking-wider text-brand-500 uppercase">{lib.shortName}</div>
            <h1 className="mt-1 text-2xl font-semibold text-brand-900">{room.name} {room.code && <span className="text-brand-900/45">· {room.code}</span>}</h1>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge tone="neutral"><Users className="size-3.5" /> Maksimum {room.capacity} nəfər</Badge>
            </div>
            {room.description && <p className="mt-3 text-sm leading-relaxed text-brand-900/70">{room.description}</p>}
            {features.length > 0 && (
              <ul className="mt-3 grid grid-cols-2 gap-1.5 text-sm text-brand-900/80">
                {features.map((f) => <li key={f} className="flex items-center gap-1.5"><Check className="size-4 text-brand-500" />{f}</li>)}
              </ul>
            )}
            <div className="mt-4 rounded-xl bg-cream/70 p-3 text-xs leading-relaxed text-brand-900">
              <b>Müddət qaydası:</b> 1 nəfər — {maxMinutesForCategory(1, rules) / 60} saat, 2 nəfər — {rules.duoMaxMinutes / 60} saat, 3 nəfər — {rules.trioMaxMinutes / 60} saat, 4+ nəfər — {rules.groupMaxMinutes / 60} saat.
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-5">
          {!day || !rd ? (
            <EmptyState title="Yaxın günlərdə rezerv üçün açıq gün yoxdur" />
          ) : (
            <>
              <Card className="p-4 sm:p-5">
                <DayPicker days={days} selected={day} hrefFor={(d) => `/rezerv/${lib.slug}/otaq/${room.slug}?gun=${d}`} />
                <div className="mt-4 mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-brand-900">{fmtDay(day)}</div>
                  <TimelineLegend />
                </div>
                <DayTimeline open={rd.open} close={rd.close} blocks={rd.blocks} />
              </Card>

              <Card className="p-5 sm:p-6">
                <SectionTitle>Vaxt seçin və rezerv edin</SectionTitle>
                <RoomBookingForm
                  roomId={room.id}
                  roomName={room.name}
                  dayLabel={fmtDay(day)}
                  starts={rd.starts}
                  maxByCategory={{ 1: rules.soloMaxMinutes, 2: rules.duoMaxMinutes, 3: rules.trioMaxMinutes, 4: rules.groupMaxMinutes }}
                  stepMinutes={rules.slotStepMinutes}
                  minDurationMinutes={rules.minDurationMinutes}
                  checkInAfterMinutes={rules.checkInAfterMinutes}
                  capacity={room.capacity}
                  domain={env.allowedDomains[0] ?? "qu.edu.az"}
                  initialStart={initialStart}
                  disabledReason={user.blockedAt ? `Hesabınız bloklanıb: ${user.blockedReason}. Bloku açmaq üçün kitabxana əməkdaşına müraciət edin.` : null}
                />
              </Card>

              {!user.blockedAt && times.length > 1 && (
                <Card className="p-5 sm:p-6">
                  <SectionTitle>Uyğun vaxt yoxdur?</SectionTitle>
                  <p className="mb-4 text-sm text-brand-900/65">
                    İstədiyiniz vaxtı seçin. Həmin aralıqda kimsə gəlməsə və ya rezervini ləğv etsə, növbədə ilk olaraq sizə bildiriş gedəcək və vaxt {rules.waitlistHoldMinutes} dəqiqə sizin üçün saxlanılacaq.
                  </p>
                  <WaitlistForm libraryId={lib.id} roomId={room.id} roomName={room.name} times={times} initialStart={waitStart && times.includes(waitStart) ? waitStart : undefined} />
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
