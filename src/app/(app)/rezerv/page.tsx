import type { Metadata } from "next";
import { RoomWizard } from "@/components/booking/room-wizard";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";

export const metadata: Metadata = { title: "Otaq rezerv et" };

export default async function ReservePage({ searchParams }: { searchParams: Promise<{ k?: string; gun?: string; otaq?: string; bas?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser({ next: "/rezerv" });
  const libraries = await db.library.findMany({
    where: { isActive: true, archivedAt: null },
    orderBy: { sortOrder: "asc" },
    include: { faculty: true, rooms: { where: { isActive: true, archivedAt: null }, select: { id: true, photos: { take: 1, orderBy: { sortOrder: "asc" }, select: { url: true } } } } },
  });
  const cards = libraries
    .filter((l) => l.rooms.length > 0)
    .map((l) => ({ slug: l.slug, name: l.name, shortName: l.shortName, building: l.building, cover: l.coverPhoto ?? l.rooms[0]?.photos[0]?.url ?? null, rooms: l.rooms.length, faculty: l.faculty?.name ?? null }));
  const k = cards.some((c) => c.slug === sp.k) ? sp.k : undefined;
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader eyebrow="Otaq rezervasiyası" title="Fərdi oxu otağı rezerv edin" subtitle="Addımları ardıcıl tamamlayın — hamısı bu ekranda." />
      <RoomWizard
        libraries={cards}
        initial={{ k, gun: sp.gun, otaq: sp.otaq, bas: sp.bas ? Number(sp.bas) : undefined }}
        domain={env.allowedDomains[0] ?? "qu.edu.az"}
        blockedReason={user.blockedAt ? `${user.blockedReason}. Yeni rezervasiya etmək üçün kitabxana administratoruna müraciət edin.` : null}
      />
    </div>
  );
}
