import type { Metadata } from "next";
import Image from "next/image";
import { ImagePlus, Laptop, Pencil, Plug, Plus, Trash2, Wrench } from "lucide-react";
import { deleteEquipmentAction, equipmentMaintenanceAction, saveEquipmentAction, uploadEquipmentPhotoAction } from "@/app/actions/admin";
import { StateForm } from "@/components/admin-ui";
import { LibraryTabs } from "@/components/library-tabs";
import { EquipmentFields } from "@/components/manage-fields";
import { ModalButton } from "@/components/modal";
import { ConfirmSubmit } from "@/components/submit-button";
import { Alert, Badge, Card, EmptyState, Field, PageHeader, SectionTitle } from "@/components/ui";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { EQUIPMENT_LABELS } from "@/lib/equipment";

export const metadata: Metadata = { title: "Avadanlıq" };

export default async function EquipmentManage({ searchParams }: { searchParams: Promise<{ k?: string }> }) {
  const ctx = await requireSuperAdmin();
  const sp = await searchParams;
  const libraries = await db.library.findMany({ where: { archivedAt: null }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true, shortName: true } });
  const libId = libraries.find((l) => l.id === (sp.k ?? ctx.libraryId))?.id ?? libraries[0]?.id;
  if (!libId) return <EmptyState title="Əvvəlcə kitabxana əlavə edin" />;
  const lib = libraries.find((l) => l.id === libId)!;
  const items = await db.equipment.findMany({
    where: { libraryId: libId, archivedAt: null },
    orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
    include: { _count: { select: { reservations: { where: { status: { in: ["BOOKED", "ISSUED", "OVERDUE"] } } } } } },
  });

  return (
    <div>
      <PageHeader
        eyebrow="İdarəetmə"
        title="Avadanlıq"
        subtitle="Fakültə kitabxanasında rezerv olunan noutbuk və adapterlər. Avadanlıq olmayan kitabxanada bu bölmə tələbələrə görünmür."
        actions={
          <ModalButton label={<><Plus className="size-4" /> Yeni avadanlıq</>} title="Yeni avadanlıq" description={lib.name}>
            <StateForm action={saveEquipmentAction} submitLabel="Əlavə et" resetOnOk><EquipmentFields libraries={libraries} libraryId={libId} /></StateForm>
          </ModalButton>
        }
      />
      <LibraryTabs libraries={libraries} current={libId} base="/admin/idare/avadanliq" />
      {items.length === 0 ? <EmptyState icon={<Laptop />} title="Bu kitabxanada rezerv olunan avadanlıq yoxdur" /> : (
        <div className="space-y-8">
          {(["LAPTOP", "ADAPTER"] as const).map((type) => {
            const list = items.filter((e) => e.type === type);
            if (!list.length) return null;
            const Icon = type === "LAPTOP" ? Laptop : Plug;
            return (
              <section key={type}>
                <SectionTitle><span className="inline-flex items-center gap-2"><Icon className="size-5 text-brand-500" /> {EQUIPMENT_LABELS[type].many} ({list.length})</span></SectionTitle>
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {list.map((e) => (
                    <Card key={e.id} className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="relative size-16 shrink-0 overflow-hidden rounded-xl bg-brand-50">{e.photoUrl && <Image src={e.photoUrl} alt="" fill sizes="64px" className="object-cover" />}</div>
                        <div className="min-w-0">
                          <div className="font-semibold text-brand-900">{e.assetTag}</div>
                          <div className="truncate text-sm text-brand-900/60">{e.name}</div>
                          <div className="mt-1">{e.underMaintenance ? <Badge tone="warning"><Wrench className="size-3" /> Təmirdə</Badge> : <Badge tone="success">Aktiv</Badge>}</div>
                        </div>
                      </div>
                      {e.underMaintenance && e.maintenanceNote && <p className="mt-2 rounded-lg bg-cream px-2.5 py-1.5 text-xs text-brand-900">{e.maintenanceNote}</p>}
                      {e.notes && <p className="mt-2 text-xs text-brand-900/55">Qeyd: {e.notes}</p>}
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <ModalButton size="sm" variant="secondary" label={<><Pencil className="size-4" /> Redaktə</>} title={`${e.assetTag} — redaktə`}>
                          <StateForm action={saveEquipmentAction}><EquipmentFields item={e} libraries={libraries} libraryId={libId} /></StateForm>
                        </ModalButton>
                        <ModalButton size="sm" variant="secondary" label={<ImagePlus className="size-4" />} title={`${e.assetTag} — şəkil`} modalSize="sm">
                          <StateForm action={uploadEquipmentPhotoAction} submitLabel="Yüklə" resetOnOk>
                            <input type="hidden" name="equipmentId" value={e.id} />
                            <Field label="Şəkil" hint="JPG, PNG və ya WEBP, ən çox 4 MB">
                              <input type="file" name="photo" accept="image/jpeg,image/png,image/webp" className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-brand-700" />
                            </Field>
                          </StateForm>
                        </ModalButton>
                        <ModalButton size="sm" variant={e.underMaintenance ? "primary" : "secondary"} label={<><Wrench className="size-4" /> {e.underMaintenance ? "Təmiri bitir" : "Təmirə"}</>} title={e.underMaintenance ? "İstifadəyə qaytar" : "Təmirə göndər"} modalSize="sm">
                          <StateForm action={equipmentMaintenanceAction} submitLabel={e.underMaintenance ? "İstifadəyə qaytar" : "Təmirə göndər"} submitVariant={e.underMaintenance ? "primary" : "danger"}>
                            <input type="hidden" name="id" value={e.id} />
                            <input type="hidden" name="on" value={e.underMaintenance ? "0" : "1"} />
                            {!e.underMaintenance && <Field label="Səbəb / qeyd"><input name="note" className="field-input" placeholder="Məs. Batareya dəyişdirilir" /></Field>}
                          </StateForm>
                        </ModalButton>
                        <ModalButton size="sm" variant="ghost" className="text-danger" label={<Trash2 className="size-4" />} title="Avadanlığı sil" modalSize="sm">
                          <Alert tone="warning" className="mb-4">{e._count.reservations ? `${e._count.reservations} aktiv/gələcək rezerv var. ` : ""}Tarixçəsi varsa hesabatlar üçün arxivdə saxlanılır.</Alert>
                          <form action={deleteEquipmentAction}><input type="hidden" name="id" value={e.id} /><ConfirmSubmit question="Əminsiniz?" confirmText="Bəli, sil">Sil</ConfirmSubmit></form>
                        </ModalButton>
                      </div>
                    </Card>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
