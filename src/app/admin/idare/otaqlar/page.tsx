import type { Metadata } from "next";
import Image from "next/image";
import { DoorOpen, ImagePlus, Pencil, Plus, Trash2, Users, Wrench } from "lucide-react";
import { deleteRoomAction, deleteRoomPhotoAction, roomMaintenanceAction, saveRoomAction, uploadRoomPhotoAction } from "@/app/actions/admin";
import { StateForm } from "@/components/admin-ui";
import { LibraryTabs } from "@/components/library-tabs";
import { RoomFields } from "@/components/manage-fields";
import { ModalButton } from "@/components/modal";
import { ConfirmSubmit } from "@/components/submit-button";
import { Alert, Badge, Card, EmptyState, Field, PageHeader } from "@/components/ui";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Oxu otaqları" };

export default async function RoomsManage({ searchParams }: { searchParams: Promise<{ k?: string }> }) {
  const ctx = await requireSuperAdmin();
  const sp = await searchParams;
  const libraries = await db.library.findMany({ where: { archivedAt: null }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, shortName: true } });
  const libId = libraries.find((l) => l.id === (sp.k ?? ctx.libraryId))?.id ?? libraries[0]?.id;
  if (!libId) return <EmptyState title="Əvvəlcə kitabxana əlavə edin" />;
  const lib = libraries.find((l) => l.id === libId)!;
  const rooms = await db.room.findMany({
    where: { libraryId: libId, archivedAt: null },
    orderBy: { sortOrder: "asc" },
    include: { photos: { orderBy: { sortOrder: "asc" } }, _count: { select: { reservations: { where: { status: "BOOKED", startAt: { gt: new Date() } } } } } },
  });

  return (
    <div>
      <PageHeader
        eyebrow="İdarəetmə"
        title="Oxu otaqları"
        subtitle="Otaqları əlavə edin, tutumunu və şəkillərini yeniləyin, təmirə bağlayın və ya silin."
        actions={
          <ModalButton label={<><Plus className="size-4" /> Yeni otaq</>} title="Yeni oxu otağı" description={lib.name} modalSize="lg">
            <StateForm action={saveRoomAction} submitLabel="Otağı əlavə et" resetOnOk><RoomFields libraryId={libId} /></StateForm>
          </ModalButton>
        }
      />
      <LibraryTabs libraries={libraries} current={libId} base="/admin/idare/otaqlar" />
      {rooms.length === 0 ? <EmptyState icon={<DoorOpen />} title="Bu kitabxanada otaq yoxdur" text="Yuxarıdakı “Yeni otaq” düyməsi ilə əlavə edin." /> : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => (
            <Card key={room.id} className="flex flex-col overflow-hidden">
              <div className="relative h-40 bg-brand-50">
                {room.photos[0] ? <Image src={room.photos[0].url} alt="" fill sizes="360px" className="object-cover" /> : <div className="grid h-full place-items-center text-brand-300"><DoorOpen className="size-10" /></div>}
                <div className="absolute top-3 left-3 flex gap-1.5">
                  {room.underMaintenance ? <Badge tone="warning"><Wrench className="size-3" /> Təmirdə</Badge> : <Badge tone="success">Aktiv</Badge>}
                  <Badge tone="neutral">{room.photos.length} şəkil</Badge>
                </div>
              </div>
              <div className="flex flex-1 flex-col p-4">
                <div className="font-semibold text-brand-900">{room.name}{room.code && <span className="font-normal text-brand-900/50"> · {room.code}</span>}</div>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-brand-900/60">
                  <span className="inline-flex items-center gap-1"><Users className="size-3.5" /> {room.capacity} nəfər</span>
                  <span>· {room._count.reservations} gələcək rezerv</span>
                </div>
                {room.underMaintenance && <p className="mt-2 rounded-lg bg-cream px-2.5 py-1.5 text-xs text-brand-900">{room.maintenanceNote ?? "Təmirdə"}{room.maintenanceSince ? ` · ${fmtDateTime(room.maintenanceSince)}-dan` : ""}</p>}
                <div className="mt-auto flex flex-wrap gap-1.5 pt-4">
                  <ModalButton size="sm" variant="secondary" label={<><Pencil className="size-4" /> Redaktə</>} title={`${room.name} — redaktə`} modalSize="lg">
                    <StateForm action={saveRoomAction}><RoomFields room={room} libraryId={libId} /></StateForm>
                  </ModalButton>
                  <ModalButton size="sm" variant="secondary" label={<><ImagePlus className="size-4" /> Şəkillər</>} title={`${room.name} — şəkillər`} modalSize="lg">
                    <div className="mb-5 grid grid-cols-3 gap-3 sm:grid-cols-4">
                      {room.photos.map((p) => (
                        <div key={p.id} className="relative aspect-[3/4] overflow-hidden rounded-xl bg-brand-50">
                          <Image src={p.url} alt="" fill sizes="160px" className="object-cover" />
                          <form action={deleteRoomPhotoAction} className="absolute right-1.5 bottom-1.5">
                            <input type="hidden" name="photoId" value={p.id} />
                            <ConfirmSubmit size="sm" question="" confirmText="Sil"><Trash2 className="size-3.5" /></ConfirmSubmit>
                          </form>
                        </div>
                      ))}
                    </div>
                    <StateForm action={uploadRoomPhotoAction} submitLabel="Şəkli yüklə" resetOnOk>
                      <input type="hidden" name="roomId" value={room.id} />
                      <Field label="Yeni şəkil" hint="JPG, PNG və ya WEBP, ən çox 4 MB">
                        <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-700" />
                      </Field>
                    </StateForm>
                  </ModalButton>
                  <ModalButton size="sm" variant={room.underMaintenance ? "primary" : "secondary"} label={<><Wrench className="size-4" /> {room.underMaintenance ? "Təmiri bitir" : "Təmirə bağla"}</>} title={room.underMaintenance ? "Otağı istifadəyə aç" : "Otağı təmirə bağla"} modalSize="sm">
                    <StateForm action={roomMaintenanceAction} submitLabel={room.underMaintenance ? "İstifadəyə aç" : "Təmirə bağla"} submitVariant={room.underMaintenance ? "primary" : "danger"}>
                      <input type="hidden" name="id" value={room.id} />
                      <input type="hidden" name="on" value={room.underMaintenance ? "0" : "1"} />
                      {!room.underMaintenance && (
                        <>
                          {room._count.reservations > 0 && <Alert tone="warning">{room._count.reservations} gələcək rezerv avtomatik ləğv ediləcək və istifadəçilərə bildiriş göndəriləcək.</Alert>}
                          <Field label="Səbəb / qeyd"><input name="note" className="field-input" placeholder="Məs. Kondisioner təmiri" /></Field>
                        </>
                      )}
                    </StateForm>
                  </ModalButton>
                  <ModalButton size="sm" variant="ghost" className="text-danger" label={<Trash2 className="size-4" />} title="Otağı sil" modalSize="sm">
                    <Alert tone="warning" className="mb-4">{room._count.reservations ? `${room._count.reservations} gələcək rezerv ləğv ediləcək. ` : ""}Otağın tarixçəsi varsa hesabatlar üçün arxivdə saxlanılır.</Alert>
                    <form action={deleteRoomAction}><input type="hidden" name="id" value={room.id} /><ConfirmSubmit question="Əminsiniz?" confirmText="Bəli, sil">Otağı sil</ConfirmSubmit></form>
                  </ModalButton>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
