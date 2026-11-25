import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarSearch } from "lucide-react";
import { EquipmentReservationCard, RoomReservationCard, WaitlistCard } from "@/components/reservation-cards";
import { EmptyState, LinkButton, PageHeader, SectionTitle, cx } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { userEquipmentReservations, userRoomReservations, userWaitlist } from "@/lib/queries";
import { checkInWindow } from "@/lib/rules";
import { getRules } from "@/lib/settings";
import { runSweep } from "@/lib/sweep";

export const metadata: Metadata = { title: "Rezervasiyalarım" };

export default async function MyReservationsPage({ searchParams }: { searchParams: Promise<{ bolme?: string }> }) {
  const sp = await searchParams;
  if (sp.bolme === "kecmis") redirect("/tarixce");
  const tab = "upcoming" as const;
  const user = await requireUser({ next: "/rezervasiyalarim" });
  await runSweep();
  const rules = await getRules();
  const [rooms, equipment, waitlist] = await Promise.all([
    userRoomReservations(user.id, tab, 50),
    userEquipmentReservations(user.id, tab, 50),
    userWaitlist(user.id),
  ]);
  const now = Date.now();
  const empty = !rooms.length && !equipment.length && !waitlist.length;
  return (
    <div>
      <PageHeader title="Rezervlərim" subtitle="Aktiv və gələcək otaq və avadanlıq rezervasiyalarınız, dəvətlər və növbə qeydləri." actions={<><LinkButton href="/rezerv">Otaq rezerv et</LinkButton><LinkButton href="/avadanliq" variant="secondary">Avadanlıq</LinkButton></>} />
      <p className="-mt-3 mb-6 text-sm text-brand-900/60">Keçmiş rezervasiyalar <Link href="/tarixce" className="font-semibold text-brand-600 underline">Tarixçə</Link> bölməsindədir.</p>
      {empty ? (
        <EmptyState icon={<CalendarSearch />} title="Aktiv rezervasiyanız yoxdur" action={<LinkButton href="/rezerv" size="sm">Rezerv et</LinkButton>} />
      ) : (
        <div className="space-y-8">
          {rooms.length > 0 && (
            <section>
              <SectionTitle>Otaqlar</SectionTitle>
              <div className="space-y-3">
                {rooms.map((r) => {
                  const w = checkInWindow(r.startAt.getTime(), rules);
                  return <RoomReservationCard key={r.id} r={r} userId={user.id} checkInOpen={now >= w.start && now <= w.end} />;
                })}
              </div>
            </section>
          )}
          {equipment.length > 0 && (
            <section>
              <SectionTitle>Avadanlıq</SectionTitle>
              <div className="space-y-3">{equipment.map((r) => <EquipmentReservationCard key={r.id} r={r} />)}</div>
            </section>
          )}
          {waitlist.length > 0 && (
            <section>
              <SectionTitle>Növbə qeydləri</SectionTitle>
              <div className="space-y-3">{waitlist.map((w) => <WaitlistCard key={w.id} w={w} back="/rezervasiyalarim" />)}</div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
