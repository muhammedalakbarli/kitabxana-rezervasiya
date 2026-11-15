import type { Metadata } from "next";
import Link from "next/link";
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
  const tab = sp.bolme === "kecmis" ? "past" : "upcoming";
  const user = await requireUser({ next: "/rezervasiyalarim" });
  await runSweep();
  const rules = await getRules();
  const [rooms, equipment, waitlist] = await Promise.all([
    userRoomReservations(user.id, tab, 50),
    userEquipmentReservations(user.id, tab, 50),
    tab === "upcoming" ? userWaitlist(user.id) : Promise.resolve([]),
  ]);
  const now = Date.now();
  const empty = !rooms.length && !equipment.length && !waitlist.length;
  return (
    <div>
      <PageHeader title="Rezervasiyalarım" subtitle="Otaq və avadanlıq rezervasiyalarınız, dəvətlər və növbə qeydləri." actions={<LinkButton href="/rezerv">Yeni rezervasiya</LinkButton>} />
      <div className="mb-6 inline-flex rounded-2xl bg-white p-1 shadow-card ring-1 ring-brand-100">
        {[["upcoming", "Aktiv və gələcək", "/rezervasiyalarim"], ["past", "Keçmiş", "/rezervasiyalarim?bolme=kecmis"]].map(([k, l, h]) => (
          <Link key={k} href={h} className={cx("rounded-xl px-4 py-2 text-sm font-semibold", tab === k ? "bg-brand-500 text-white" : "text-brand-800 hover:bg-brand-50")}>{l}</Link>
        ))}
      </div>
      {empty ? (
        <EmptyState icon={<CalendarSearch />} title={tab === "upcoming" ? "Aktiv rezervasiyanız yoxdur" : "Keçmiş rezervasiya yoxdur"} action={tab === "upcoming" ? <LinkButton href="/rezerv" size="sm">Rezerv et</LinkButton> : undefined} />
      ) : (
        <div className="space-y-8">
          {rooms.length > 0 && (
            <section>
              <SectionTitle>Otaqlar</SectionTitle>
              <div className="space-y-3">
                {rooms.map((r) => {
                  const w = checkInWindow(r.startAt.getTime(), rules);
                  return <RoomReservationCard key={r.id} r={r} userId={user.id} checkInOpen={tab === "upcoming" && now >= w.start && now <= w.end} />;
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
