import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ImagePlus, Laptop, Plug, QrCode, Trash2 } from "lucide-react";
import { deleteRoomPhotoAction, uploadEquipmentPhotoAction, uploadRoomPhotoAction } from "@/app/actions/admin";
import { EquipmentForm, LibraryForm, RoomForm } from "@/components/admin-forms";
import { SubmitButton } from "@/components/submit-button";
import { Badge, Card, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { hhmm } from "@/lib/time";

export const metadata: Metadata = { title: "Kitabxana" };

export default async function LibraryAdmin({ params }: { params: Promise<{ id: string }> }) {
  await requireAdmin();
  const { id } = await params;
  const lib = await db.library.findUnique({
    where: { id },
    include: {
      rooms: { orderBy: { sortOrder: "asc" }, include: { photos: { orderBy: { sortOrder: "asc" } } } },
      equipment: { orderBy: [{ type: "asc" }, { sortOrder: "asc" }] },
    },
  });
  if (!lib) notFound();
  const libraries = await db.library.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });

  return (
    <div className="space-y-8">
      <div>
        <Link href="/admin/kitabxanalar" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"><ArrowLeft className="size-4" /> Kitabxanalar</Link>
        <PageHeader title={lib.name} subtitle={`${lib.building} · ${hhmm(lib.openMinute)}–${hhmm(lib.closeMinute)}`} actions={<LinkButton href={`/admin/qr?kitabxana=${lib.id}`} variant="secondary" size="sm"><QrCode className="size-4" /> QR kodları çap et</LinkButton>} />
      </div>

      <Card className="p-5 sm:p-6">
        <SectionTitle>Kitabxana məlumatları</SectionTitle>
        <LibraryForm lib={{ id: lib.id, name: lib.name, shortName: lib.shortName, building: lib.building, address: lib.address, description: lib.description, open: hhmm(lib.openMinute), close: hhmm(lib.closeMinute), workDays: lib.workDays, isActive: lib.isActive, sortOrder: lib.sortOrder }} />
      </Card>

      <section>
        <SectionTitle>Otaqlar ({lib.rooms.length})</SectionTitle>
        <div className="space-y-4">
          {lib.rooms.map((room) => (
            <Card key={room.id} className="p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 font-semibold text-brand-900">{room.name}{room.code && <span className="text-brand-900/50">· {room.code}</span>}{!room.isActive && <Badge tone="warning">Deaktiv</Badge>}</div>
                <span className="text-xs text-brand-900/50">QR kod: <b className="tracking-wider">{room.qrToken}</b></span>
              </div>
              <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
                <RoomForm libraryId={lib.id} room={room} />
                <div>
                  <div className="mb-2 text-sm font-medium text-brand-900">Fotoşəkillər</div>
                  <div className="grid grid-cols-3 gap-2">
                    {room.photos.map((p) => (
                      <div key={p.id} className="group relative aspect-[3/4] overflow-hidden rounded-xl bg-brand-50">
                        <Image src={p.url} alt="" fill sizes="100px" className="object-cover" />
                        <form action={deleteRoomPhotoAction} className="absolute top-1 right-1">
                          <input type="hidden" name="photoId" value={p.id} />
                          <button className="grid size-7 place-items-center rounded-lg bg-white/90 text-danger opacity-0 shadow transition group-hover:opacity-100 focus:opacity-100" aria-label="Şəkli sil"><Trash2 className="size-4" /></button>
                        </form>
                      </div>
                    ))}
                  </div>
                  <form action={uploadRoomPhotoAction} className="mt-3 space-y-2">
                    <input type="hidden" name="roomId" value={room.id} />
                    <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required className="block w-full text-xs file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-700" />
                    <SubmitButton size="sm" variant="secondary"><ImagePlus className="size-4" /> Şəkil yüklə</SubmitButton>
                  </form>
                </div>
              </div>
            </Card>
          ))}
          <Card className="border-dashed p-5">
            <SectionTitle>Yeni otaq</SectionTitle>
            <RoomForm libraryId={lib.id} />
          </Card>
        </div>
      </section>

      <section>
        <SectionTitle>Avadanlıq ({lib.equipment.length})</SectionTitle>
        <div className="grid gap-4 xl:grid-cols-2">
          {lib.equipment.map((e) => (
            <Card key={e.id} className="p-5">
              <div className="mb-3 flex items-center gap-3">
                <div className="relative size-14 shrink-0 overflow-hidden rounded-xl bg-brand-50">{e.photoUrl && <Image src={e.photoUrl} alt="" fill sizes="56px" className="object-cover" />}</div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 font-semibold text-brand-900">{e.type === "LAPTOP" ? <Laptop className="size-4" /> : <Plug className="size-4" />} {e.assetTag}{!e.isActive && <Badge tone="warning">Xidmətdə</Badge>}</div>
                  <div className="text-xs text-brand-900/50">QR: {e.qrToken}</div>
                </div>
              </div>
              <EquipmentForm libraries={libraries} defaultLibraryId={lib.id} item={e} />
              <form action={uploadEquipmentPhotoAction} className="mt-3 flex items-center gap-2 border-t border-brand-100 pt-3">
                <input type="hidden" name="equipmentId" value={e.id} />
                <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" required className="min-w-0 flex-1 text-xs file:mr-2 file:rounded-lg file:border-0 file:bg-brand-50 file:px-2.5 file:py-1.5 file:text-xs file:font-semibold file:text-brand-700" />
                <SubmitButton size="sm" variant="ghost"><ImagePlus className="size-4" /> Şəkil</SubmitButton>
              </form>
            </Card>
          ))}
          <Card className="border-dashed p-5">
            <SectionTitle>Yeni avadanlıq</SectionTitle>
            <EquipmentForm libraries={libraries} defaultLibraryId={lib.id} />
          </Card>
        </div>
      </section>
    </div>
  );
}
