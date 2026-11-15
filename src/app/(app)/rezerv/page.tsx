import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, DoorOpen, Laptop, Plug } from "lucide-react";
import { Badge, PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { hhmm } from "@/lib/time";

export const metadata: Metadata = { title: "Rezerv et" };

export default async function ChooseLibraryPage() {
  await requireUser({ next: "/rezerv" });
  const libraries = await db.library.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: {
      rooms: { where: { isActive: true }, select: { id: true } },
      equipment: { where: { isActive: true }, select: { type: true } },
    },
  });
  return (
    <div>
      <PageHeader eyebrow="Addım 1" title="Hansı binadasınız?" subtitle="Kitabxananı seçin — həmin kitabxanadakı otaqlar və avadanlıqların boş vaxtları görünəcək." />
      <div className="grid gap-5 md:grid-cols-2">
        {libraries.map((lib) => {
          const laptops = lib.equipment.filter((e) => e.type === "LAPTOP").length;
          const adapters = lib.equipment.filter((e) => e.type === "ADAPTER").length;
          return (
            <Link key={lib.id} href={`/rezerv/${lib.slug}`} className="card group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lift">
              <div className="relative h-48 overflow-hidden sm:h-56">
                {lib.coverPhoto && <Image src={lib.coverPhoto} alt="" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-cover transition duration-500 group-hover:scale-105" />}
                <div className="absolute inset-0 bg-gradient-to-t from-brand-900/85 via-brand-900/15 to-transparent" />
                <div className="absolute bottom-4 left-5 right-5 text-white">
                  <div className="text-xl font-semibold">{lib.name}</div>
                  <div className="text-sm text-white/80">{lib.building} · {hhmm(lib.openMinute)}–{hhmm(lib.closeMinute)}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div className="flex flex-wrap gap-2">
                  <Badge tone="success"><DoorOpen className="size-3.5" /> {lib.rooms.length} otaq</Badge>
                  {laptops > 0 && <Badge tone="info"><Laptop className="size-3.5" /> {laptops} noutbuk</Badge>}
                  {adapters > 0 && <Badge tone="cream"><Plug className="size-3.5" /> {adapters} adapter</Badge>}
                </div>
                <span className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600 transition-all group-hover:gap-2">Seç <ArrowRight className="size-4" /></span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
