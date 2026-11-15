import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Building2 } from "lucide-react";
import { LibraryForm } from "@/components/admin-forms";
import { Badge, Card, PageHeader, SectionTitle } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { hhmm } from "@/lib/time";

export const metadata: Metadata = { title: "Kitabxanalar" };

export default async function LibrariesAdmin() {
  await requireAdmin();
  const libs = await db.library.findMany({ orderBy: { sortOrder: "asc" }, include: { _count: { select: { rooms: true, equipment: true } } } });
  return (
    <div>
      <PageHeader title="Kitabxanalar" subtitle="Yeni fakültə binaları istifadəyə verildikcə kitabxanaları buradan əlavə edin — otaqlar, avadanlıq və qaydalar avtomatik tətbiq olunur." />
      <div className="mb-8 grid gap-4 md:grid-cols-2">
        {libs.map((l) => (
          <Link key={l.id} href={`/admin/kitabxanalar/${l.id}`} className="card group flex gap-4 p-4 transition hover:shadow-lift">
            <div className="relative size-20 shrink-0 overflow-hidden rounded-xl bg-brand-50">
              {l.coverPhoto ? <Image src={l.coverPhoto} alt="" fill sizes="80px" className="object-cover" /> : <Building2 className="m-6 size-8 text-brand-300" />}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><span className="truncate font-semibold text-brand-900">{l.name}</span>{!l.isActive && <Badge tone="warning">Deaktiv</Badge>}</div>
              <div className="text-sm text-brand-900/60">{l.building} · {hhmm(l.openMinute)}–{hhmm(l.closeMinute)}</div>
              <div className="mt-2 flex gap-2"><Badge tone="success">{l._count.rooms} otaq</Badge><Badge tone="info">{l._count.equipment} avadanlıq</Badge></div>
            </div>
            <ArrowRight className="size-5 self-center text-brand-300 transition group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
      <Card className="p-5 sm:p-6">
        <SectionTitle>Yeni kitabxana əlavə et</SectionTitle>
        <LibraryForm />
      </Card>
    </div>
  );
}
