import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Laptop, Plug } from "lucide-react";
import { DayPicker } from "@/components/day-picker";
import { EquipmentBookingForm } from "@/components/equipment-booking-form";
import { DayTimeline, TimelineLegend } from "@/components/timeline";
import { Badge, Card, EmptyState, SectionTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { closedDaysFor, equipmentDay } from "@/lib/availability";
import { db } from "@/lib/db";
import { EQUIPMENT_LABELS, maxMinutesForType } from "@/lib/equipment";
import { bookableDays, equipmentExtensionLimit } from "@/lib/rules";
import { getRules } from "@/lib/settings";
import { runSweep } from "@/lib/sweep";
import { fmtDay, fmtDuration, isValidDayKey } from "@/lib/time";

type Props = { params: Promise<{ library: string; item: string }>; searchParams: Promise<{ gun?: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { item } = await params;
  return { title: item.toUpperCase() };
}

export default async function EquipmentPage({ params, searchParams }: Props) {
  const { library, item } = await params;
  const sp = await searchParams;
  const user = await requireUser({ next: `/rezerv/${library}/avadanliq/${item}` });
  await runSweep();
  const eq = await db.equipment.findFirst({ where: { assetTag: item.toUpperCase(), library: { slug: library } }, include: { library: true } });
  if (!eq || !eq.library.isActive) notFound();
  const lib = eq.library;
  const rules = await getRules();
  const closed = await closedDaysFor(lib.id);
  const days = bookableDays(new Date(), lib, rules.maxAdvanceDays, closed);
  const day = isValidDayKey(sp.gun) && days.includes(sp.gun) ? sp.gun : days[0];
  const d = day && eq.isActive ? await equipmentDay(eq.id, lib, day, user.id) : null;
  const max = maxMinutesForType(eq.type, rules);
  const Icon = eq.type === "LAPTOP" ? Laptop : Plug;

  return (
    <div>
      <Link href={`/rezerv/${lib.slug}?bolme=avadanliq${day ? `&gun=${day}` : ""}`} className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
        <ArrowLeft className="size-4" /> {lib.name} · avadanlıq
      </Link>
      <div className="grid gap-6 lg:grid-cols-[340px_1fr]">
        <Card className="h-fit overflow-hidden">
          <div className="relative aspect-[4/3] bg-brand-50">
            {eq.photoUrl && <Image src={eq.photoUrl} alt={eq.name} fill sizes="340px" className="object-cover" priority />}
          </div>
          <div className="p-5">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-wider text-brand-500 uppercase"><Icon className="size-4" /> {EQUIPMENT_LABELS[eq.type].one}</div>
            <h1 className="mt-1 text-2xl font-semibold text-brand-900">{eq.name}</h1>
            <Badge tone="cream" className="mt-2">ID: {eq.assetTag}</Badge>
            {eq.description && <p className="mt-3 text-sm leading-relaxed text-brand-900/70">{eq.description}</p>}
            <ul className="mt-4 space-y-1.5 text-sm text-brand-900/80">
              <li>• Maksimum müddət: <b>{fmtDuration(max)}</b></li>
              <li>• Uzatma: bir dəfə, maksimum <b>{fmtDuration(equipmentExtensionLimit(max, rules.equipmentExtensionPercent))}</b></li>
              {eq.type === "LAPTOP" && <li>• Yalnız kitabxananın oxu zalında istifadə olunur</li>}
            </ul>
          </div>
        </Card>
        <div className="min-w-0 space-y-5">
          {!eq.isActive ? (
            <EmptyState title="Bu avadanlıq hazırda texniki xidmətdədir" text="Eyni tipli digər avadanlığı seçin." />
          ) : !day || !d ? (
            <EmptyState title="Yaxın günlərdə rezerv üçün açıq gün yoxdur" />
          ) : (
            <>
              <Card className="p-4 sm:p-5">
                <DayPicker days={days} selected={day} hrefFor={(x) => `/rezerv/${lib.slug}/avadanliq/${item}?gun=${x}`} />
                <div className="mt-4 mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-brand-900">{fmtDay(day)}</div>
                  <TimelineLegend withHold={false} />
                </div>
                <DayTimeline open={d.open} close={d.close} blocks={d.blocks} />
              </Card>
              <Card className="p-5 sm:p-6">
                <SectionTitle>Vaxt seçin</SectionTitle>
                <EquipmentBookingForm
                  equipmentId={eq.id}
                  label={`${eq.name} (${eq.assetTag})`}
                  dayLabel={fmtDay(day)}
                  starts={d.starts}
                  maxMinutes={max}
                  stepMinutes={rules.slotStepMinutes}
                  minDurationMinutes={rules.minDurationMinutes}
                  extensionMinutes={equipmentExtensionLimit(max, rules.equipmentExtensionPercent)}
                  pickupGrace={rules.equipmentPickupGraceMinutes}
                  isLaptop={eq.type === "LAPTOP"}
                  disabledReason={user.blockedAt ? `Hesabınız bloklanıb: ${user.blockedReason}.` : null}
                />
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
