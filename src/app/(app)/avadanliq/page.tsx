import type { Metadata } from "next";
import Link from "next/link";
import { EquipmentWizard } from "@/components/booking/equipment-wizard";
import { EquipmentReservationCard } from "@/components/reservation-cards";
import { PageHeader, SectionTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { userEquipmentReservations } from "@/lib/queries";

export const metadata: Metadata = { title: "Avadanlıq rezervi" };

export default async function EquipmentPanel({ searchParams }: { searchParams: Promise<{ k?: string; item?: string; gun?: string; nov?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser({ next: "/avadanliq" });
  const [libraries, mine] = await Promise.all([
    db.library.findMany({
      where: { isActive: true, archivedAt: null },
      orderBy: { sortOrder: "asc" },
      include: { faculty: true, equipment: { where: { isActive: true, archivedAt: null }, select: { type: true, photoUrl: true } } },
    }),
    userEquipmentReservations(user.id, "upcoming", 10),
  ]);
  const cards = libraries
    .filter((l) => l.equipment.length > 0)
    .map((l) => ({
      slug: l.slug, name: l.name, shortName: l.shortName, building: l.building, faculty: l.faculty?.name ?? null,
      cover: l.equipment.find((e) => e.type === "LAPTOP")?.photoUrl ?? l.equipment[0]?.photoUrl ?? null,
      rooms: 0, laptops: l.equipment.filter((e) => e.type === "LAPTOP").length, adapters: l.equipment.filter((e) => e.type === "ADAPTER").length,
    }));
  const k = cards.some((c) => c.slug === sp.k) ? sp.k : undefined;
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <PageHeader eyebrow="Avadanlıq" title="Noutbuk və adapter rezerv edin" subtitle="Hər avadanlıq öz ID-si ilə görünür. Noutbuk yalnız oxu zalında istifadə üçün təqdim olunur." />
        <EquipmentWizard
          libraries={cards}
          initial={{ k, item: sp.item, gun: sp.gun, nov: sp.nov === "ADAPTER" ? "ADAPTER" : sp.nov === "LAPTOP" ? "LAPTOP" : undefined }}
          blockedReason={user.blockedAt ? `${user.blockedReason}. Bloku açmaq üçün kitabxana administratoruna müraciət edin.` : null}
        />
      </div>
      {mine.length > 0 && (
        <section>
          <SectionTitle action={<Link href="/tarixce" className="text-sm font-semibold text-brand-600">Tarixçə →</Link>}>Aktiv avadanlıq rezervlərim</SectionTitle>
          <div className="space-y-3">{mine.map((r) => <EquipmentReservationCard key={r.id} r={r} />)}</div>
        </section>
      )}
    </div>
  );
}
