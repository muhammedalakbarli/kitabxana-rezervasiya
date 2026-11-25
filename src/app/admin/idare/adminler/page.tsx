import type { Metadata } from "next";
import Link from "next/link";
import { Plus, ShieldCheck, UserCog, UserMinus } from "lucide-react";
import { removeSupervisorAction, saveSupervisorAction } from "@/app/actions/admin";
import { StateForm } from "@/components/admin-ui";
import { ModalButton } from "@/components/modal";
import { ConfirmSubmit } from "@/components/submit-button";
import { Avatar, Badge, Card, EmptyState, Field, PageHeader, SectionTitle } from "@/components/ui";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { fmtDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Adminlər" };

function SupervisorFields({ libraries, s }: { libraries: { id: string; name: string }[]; s?: { email: string; firstName: string | null; lastName: string | null; libraryId: string | null } }) {
  return (
    <>
      <Field label="Universitet e-poçtu" required>
        <input name="email" type="email" defaultValue={s?.email} readOnly={Boolean(s)} className="field-input" placeholder={`ad.soyad@${env.allowedDomains[0] ?? "qu.edu.az"}`} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Ad" required><input name="firstName" defaultValue={s?.firstName ?? ""} className="field-input" /></Field>
        <Field label="Soyad" required><input name="lastName" defaultValue={s?.lastName ?? ""} className="field-input" /></Field>
      </div>
      <Field label="Məsul olduğu kitabxana" required>
        <select name="libraryId" defaultValue={s?.libraryId ?? ""} className="field-input">
          <option value="">Seçin</option>
          {libraries.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
        </select>
      </Field>
      {s && <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="newPassword" value="1" className="accent-brand-500" /> Yeni müvəqqəti şifrə yarat</label>}
    </>
  );
}

export default async function AdminsPage() {
  await requireSuperAdmin();
  const [libraries, supervisors, superAdmins] = await Promise.all([
    db.library.findMany({ where: { archivedAt: null }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
    db.user.findMany({ where: { role: "SUPERVISOR" }, include: { library: true }, orderBy: [{ libraryId: "asc" }, { name: "asc" }] }),
    db.user.findMany({ where: { role: "SUPERADMIN" }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="İdarəetmə"
        title="Adminlər"
        subtitle="Supervayzer (fakültə kitabxanası admini) yalnız öz kitabxanasının canlı vəziyyətini, rezervasiyalarını, avadanlıq masasını və hesabatlarını görür. Struktur dəyişiklikləri yalnız super admin edir."
        actions={
          <ModalButton label={<><Plus className="size-4" /> Yeni supervayzer</>} title="Supervayzer təyin et" description="Müvəqqəti şifrə yaradılacaq — ilk girişdə dəyişdiriləcək." modalSize="sm">
            <StateForm action={saveSupervisorAction} submitLabel="Təyin et"><SupervisorFields libraries={libraries} /></StateForm>
          </ModalButton>
        }
      />
      <section>
        <SectionTitle><span className="inline-flex items-center gap-2"><UserCog className="size-5 text-brand-500" /> Supervayzerlər ({supervisors.length})</span></SectionTitle>
        {supervisors.length === 0 ? <EmptyState title="Hələ supervayzer təyin olunmayıb" /> : (
          <Card className="divide-y divide-brand-100">
            {supervisors.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                <Avatar name={s.name} email={s.email} />
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/istifadeciler/${s.id}`} className="font-medium text-brand-900 hover:underline">{s.name ?? s.email}</Link>
                  <div className="text-xs text-brand-900/55">{s.email} · son giriş: {s.lastLoginAt ? fmtDateTime(s.lastLoginAt) : "hələ daxil olmayıb"}</div>
                </div>
                {s.library ? <Badge tone="info">{s.library.name}</Badge> : <Badge tone="warning">Kitabxana təyin olunmayıb</Badge>}
                {s.mustChangePassword && <Badge tone="cream">Müvəqqəti şifrə</Badge>}
                <div className="flex gap-1">
                  <ModalButton size="sm" variant="secondary" label="Dəyiş" title="Supervayzer" modalSize="sm">
                    <StateForm action={saveSupervisorAction}><SupervisorFields libraries={libraries} s={s} /></StateForm>
                  </ModalButton>
                  <form action={removeSupervisorAction}><input type="hidden" name="userId" value={s.id} /><ConfirmSubmit size="sm" question="Admin hüquqları götürülsün?" confirmText="Bəli"><UserMinus className="size-4" /></ConfirmSubmit></form>
                </div>
              </div>
            ))}
          </Card>
        )}
      </section>
      <section>
        <SectionTitle><span className="inline-flex items-center gap-2"><ShieldCheck className="size-5 text-brand-500" /> Super adminlər ({superAdmins.length})</span></SectionTitle>
        <Card className="divide-y divide-brand-100">
          {superAdmins.map((s) => (
            <div key={s.id} className="flex items-center gap-3 px-4 py-3">
              <Avatar name={s.name} email={s.email} />
              <div className="min-w-0 flex-1">
                <Link href={`/admin/istifadeciler/${s.id}`} className="font-medium text-brand-900 hover:underline">{s.name ?? s.email}</Link>
                <div className="text-xs text-brand-900/55">{s.email}</div>
              </div>
              <Badge tone="brand">Super admin</Badge>
            </div>
          ))}
        </Card>
        <p className="mt-2 text-xs text-brand-900/55">Super admin rolu istifadəçinin səhifəsindən (“Rol və kitabxana”) verilir.</p>
      </section>
    </div>
  );
}
