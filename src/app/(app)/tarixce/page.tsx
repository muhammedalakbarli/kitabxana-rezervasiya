import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, Clock3, DoorOpen, History, Laptop, UserX } from "lucide-react";
import { EquipmentReservationCard, RoomReservationCard } from "@/components/reservation-cards";
import { Card, EmptyState, PageHeader, Stat, cx } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { userEquipmentReservations, userRoomReservations } from "@/lib/queries";
import { getRules } from "@/lib/settings";

export const metadata: Metadata = { title: "Tarixçə" };

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ bolme?: string }> }) {
  const sp = await searchParams;
  const tab = sp.bolme === "avadanliq" ? "eq" : "room";
  const user = await requireUser({ next: "/tarixce" });
  const rules = await getRules();
  const [rooms, equipment, visits] = await Promise.all([
    userRoomReservations(user.id, "past", 100),
    userEquipmentReservations(user.id, "past", 100),
    db.reservationParticipant.findMany({ where: { userId: user.id, checkedInAt: { not: null } }, select: { reservation: { select: { startAt: true, endAt: true } } } }),
  ]);
  const hours = Math.round(visits.reduce((s, v) => s + (v.reservation.endAt.getTime() - v.reservation.startAt.getTime()) / 3600_000, 0) * 10) / 10;
  const noShows = rooms.filter((r) => r.status === "NO_SHOW" && r.ownerId === user.id).length;
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Tarixçə" subtitle={`Son ${Math.round(rules.retentionDays / 30)} ay ərzindəki rezervasiyalarınız. Daha köhnə qeydlər avtomatik silinir.`} />
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Otaq ziyarəti" value={visits.length} icon={<DoorOpen className="size-5" />} />
        <Stat label="Ümumi saat" value={hours} icon={<Clock3 className="size-5" />} tone="mint" />
        <Stat label="Avadanlıq" value={equipment.filter((e) => e.status === "RETURNED").length} icon={<Laptop className="size-5" />} tone="sky" />
        <Stat label="Gəlməmə" value={`${noShows}`} icon={<UserX className="size-5" />} tone={noShows ? "danger" : "brand"} hint={`xəbərdarlıq ${user.noShowStrikes}/${rules.noShowLimit}`} />
      </div>
      <div className="mb-5 inline-flex rounded-2xl bg-white p-1 shadow-card ring-1 ring-brand-100">
        {[["room", "Otaqlar", "/tarixce"], ["eq", "Avadanlıq", "/tarixce?bolme=avadanliq"]].map(([k, l, h]) => (
          <Link key={k} href={h} className={cx("rounded-xl px-4 py-2 text-sm font-semibold", tab === k ? "bg-brand-500 text-white" : "text-brand-800 hover:bg-brand-50")}>{l}</Link>
        ))}
      </div>
      {tab === "room" ? (
        rooms.length ? <div className="space-y-3">{rooms.map((r) => <RoomReservationCard key={r.id} r={r} userId={user.id} />)}</div> : <EmptyState icon={<History />} title="Hələ keçmiş otaq rezervasiyası yoxdur" />
      ) : equipment.length ? (
        <div className="space-y-3">{equipment.map((r) => <EquipmentReservationCard key={r.id} r={r} />)}</div>
      ) : (
        <EmptyState icon={<History />} title="Hələ keçmiş avadanlıq rezervasiyası yoxdur" />
      )}
      <Card className="mt-8 flex items-center gap-3 p-4 text-sm text-brand-900/70">
        <CalendarClock className="size-5 shrink-0 text-brand-500" />
        <span>Aktiv və gələcək rezervasiyalarınız <Link href="/rezervasiyalarim" className="font-semibold text-brand-600 underline">Rezervlərim</Link> bölməsindədir.</span>
      </Card>
    </div>
  );
}
