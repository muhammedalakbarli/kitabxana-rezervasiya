import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Clock, DoorOpen, GraduationCap, Laptop, Pencil, Plus, Trash2, Users } from "lucide-react";
import { archiveLibraryAction, deleteFacultyAction, saveFacultyAction, saveLibraryAction, saveLibraryHoursAction, setScopeAction } from "@/app/actions/admin";
import { StateForm } from "@/components/admin-ui";
import { FacultyFields, HoursFields, LibraryFields } from "@/components/manage-fields";
import { ModalButton } from "@/components/modal";
import { ConfirmSubmit, SubmitButton } from "@/components/submit-button";
import { Alert, Badge, Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { roomHours } from "@/lib/rules";
import { hhmm, WEEKDAYS_SHORT } from "@/lib/time";

export const metadata: Metadata = { title: "Fakültə və kitabxanalar" };

export default async function LibrariesManage() {
  await requireSuperAdmin();
  const [faculties, libraries] = await Promise.all([
    db.faculty.findMany({ orderBy: [{ sortOrder: "asc" }, { name: "asc" }], include: { _count: { select: { users: true, libraries: true } } } }),
    db.library.findMany({
      where: { archivedAt: null },
      orderBy: { sortOrder: "asc" },
      include: {
        faculty: true,
        supervisors: { select: { name: true, email: true } },
        _count: { select: { rooms: { where: { archivedAt: null } }, equipment: { where: { archivedAt: null } } } },
      },
    }),
  ]);
  return (
    <div className="space-y-10">
      <PageHeader
        eyebrow="İdarəetmə"
        title="Fakültə və kitabxanalar"
        subtitle="Yeni fakültə binaları istifadəyə verildikcə onların kitabxanalarını buradan əlavə edin. İş saatları və rezervasiya vaxtları hər kitabxana üçün ayrıca tənzimlənir."
        actions={
          <ModalButton label={<><Plus className="size-4" /> Yeni kitabxana</>} title="Yeni fakültə kitabxanası" description="Yaradıldıqdan sonra oxu otaqlarını və avadanlığı əlavə edəcəksiniz." modalSize="lg">
            <StateForm action={saveLibraryAction} submitLabel="Kitabxananı yarat"><LibraryFields faculties={faculties} /></StateForm>
          </ModalButton>
        }
      />

      <section>
        <SectionTitle>Kitabxanalar ({libraries.length})</SectionTitle>
        {libraries.length === 0 ? <EmptyState icon={<Building2 />} title="Hələ kitabxana yoxdur" /> : (
          <div className="grid gap-4 xl:grid-cols-2">
            {libraries.map((lib) => {
              const rh = roomHours(lib);
              const days = lib.workDays.split(",").map((d) => WEEKDAYS_SHORT[Number(d) - 1]).join(", ");
              return (
                <Card key={lib.id} className="p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-brand-900">{lib.name}</h3>
                        {!lib.isActive && <Badge tone="warning">Müvəqqəti bağlı</Badge>}
                      </div>
                      <div className="text-sm text-brand-900/60">{lib.faculty?.name ?? "Fakültəyə bağlı deyil"} · {lib.building}</div>
                    </div>
                    <form action={setScopeAction}>
                      <input type="hidden" name="libraryId" value={lib.id} />
                      <input type="hidden" name="back" value="/admin" />
                      <SubmitButton size="sm" variant="ghost">Canlı →</SubmitButton>
                    </form>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <div className="rounded-xl bg-brand-50/70 p-3"><dt className="flex items-center gap-1.5 text-xs text-brand-900/55"><Clock className="size-3.5" /> İş saatları</dt><dd className="font-semibold text-brand-900">{hhmm(lib.openMinute)}–{hhmm(lib.closeMinute)}</dd><dd className="text-xs text-brand-900/55">{days}</dd></div>
                    <div className="rounded-xl bg-mint/50 p-3"><dt className="flex items-center gap-1.5 text-xs text-brand-900/55"><DoorOpen className="size-3.5" /> Otaq rezervasiyası</dt><dd className="font-semibold text-brand-900">{hhmm(rh.openMinute)}–{hhmm(rh.closeMinute)}</dd><dd className="text-xs text-brand-900/55">ilk başlanğıc – son bitmə</dd></div>
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs">
                    <Link href={`/admin/idare/otaqlar?k=${lib.id}`} className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 font-semibold text-brand-800 ring-1 ring-brand-100 hover:bg-brand-50"><DoorOpen className="size-3.5" /> {lib._count.rooms} oxu otağı</Link>
                    <Link href={`/admin/idare/avadanliq?k=${lib.id}`} className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 font-semibold text-brand-800 ring-1 ring-brand-100 hover:bg-brand-50"><Laptop className="size-3.5" /> {lib._count.equipment} avadanlıq</Link>
                    <Link href="/admin/idare/adminler" className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1 font-semibold text-brand-800 ring-1 ring-brand-100 hover:bg-brand-50"><Users className="size-3.5" /> {lib.supervisors.length ? lib.supervisors.map((s) => s.name ?? s.email).join(", ") : "Supervayzer yoxdur"}</Link>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 border-t border-brand-100 pt-4">
                    <ModalButton variant="secondary" size="sm" label={<><Pencil className="size-4" /> Məlumatlar</>} title={lib.name} modalSize="lg">
                      <StateForm action={saveLibraryAction}><LibraryFields lib={lib} faculties={faculties} /></StateForm>
                    </ModalButton>
                    <ModalButton variant="secondary" size="sm" label={<><Clock className="size-4" /> İş saatları və rezerv vaxtları</>} title="İş saatları və rezervasiya vaxtları" description={lib.name}>
                      <StateForm action={saveLibraryHoursAction}><HoursFields lib={lib} /></StateForm>
                    </ModalButton>
                    <ModalButton variant="ghost" size="sm" className="text-danger" label={<><Trash2 className="size-4" /> Sil</>} title="Kitabxananı sil" modalSize="sm">
                      <Alert tone="warning" className="mb-4">Kitabxana, onun {lib._count.rooms} otağı və {lib._count.equipment} avadanlığı istifadədən çıxarılacaq, gələcək rezervlər ləğv ediləcək. Tarixçə hesabatlarda saxlanılır.</Alert>
                      <form action={archiveLibraryAction}>
                        <input type="hidden" name="id" value={lib.id} />
                        <ConfirmSubmit question="Əminsiniz?" confirmText="Bəli, sil">Kitabxananı sil</ConfirmSubmit>
                      </form>
                    </ModalButton>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </section>

      <section>
        <SectionTitle action={
          <ModalButton size="sm" variant="secondary" label={<><Plus className="size-4" /> Fakültə əlavə et</>} title="Yeni fakültə" modalSize="sm">
            <StateForm action={saveFacultyAction} resetOnOk><FacultyFields /></StateForm>
          </ModalButton>
        }>
          <span className="inline-flex items-center gap-2"><GraduationCap className="size-5 text-brand-500" /> Fakültələr</span>
        </SectionTitle>
        <p className="-mt-1 mb-3 text-sm text-brand-900/60">Tələbələr profildə bu siyahıdan fakültə seçir. Hesabatlarda istifadə fakültələr üzrə göstərilir.</p>
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead className="border-b border-brand-100 bg-brand-50/60 text-left text-xs font-semibold text-brand-900/60 uppercase"><tr><th className="px-4 py-3">Fakültə</th><th className="px-4 py-3">Tələbə</th><th className="px-4 py-3">Kitabxana</th><th className="px-4 py-3">Status</th><th className="px-4 py-3" /></tr></thead>
            <tbody className="divide-y divide-brand-100">
              {faculties.map((f) => (
                <tr key={f.id}>
                  <td className="px-4 py-2.5 font-medium text-brand-900">{f.name}{f.shortName && <span className="ml-1 text-brand-900/45">({f.shortName})</span>}</td>
                  <td className="px-4 py-2.5">{f._count.users}</td>
                  <td className="px-4 py-2.5">{f._count.libraries}</td>
                  <td className="px-4 py-2.5">{f.isActive ? <Badge tone="success">Aktiv</Badge> : <Badge tone="neutral">Deaktiv</Badge>}</td>
                  <td className="px-4 py-2.5">
                    <div className="flex justify-end gap-1">
                      <ModalButton size="sm" variant="ghost" label={<Pencil className="size-4" />} title="Fakültəni redaktə et" modalSize="sm">
                        <StateForm action={saveFacultyAction}><FacultyFields f={f} /></StateForm>
                      </ModalButton>
                      <form action={deleteFacultyAction}><input type="hidden" name="id" value={f.id} /><ConfirmSubmit size="sm" question="Silinsin?" confirmText="Sil"><Trash2 className="size-4" /></ConfirmSubmit></form>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>
    </div>
  );
}
