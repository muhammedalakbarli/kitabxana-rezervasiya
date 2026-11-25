import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, History, KeyRound, ListChecks, ShieldAlert } from "lucide-react";
import { ChangePasswordForm, ProfileForm } from "@/components/profile-forms";
import { Alert, Avatar, Badge, Card, KeyValue, PageHeader, SectionTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/labels";
import { getRules } from "@/lib/settings";
import { fmtDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage() {
  const user = await requireUser({ next: "/profil" });
  const [rules, faculties, roomCount, eqCount] = await Promise.all([
    getRules(),
    db.faculty.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }),
    db.reservationParticipant.count({ where: { userId: user.id, checkedInAt: { not: null } } }),
    db.equipmentReservation.count({ where: { userId: user.id, status: "RETURNED" } }),
  ]);
  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title={<span className="flex items-center gap-3"><Avatar name={user.name} email={user.email} size={44} /> {user.name ?? "Profilim"}</span>}
        subtitle={[user.faculty, user.specialty, user.course ? `${user.course}-ci kurs` : null, user.groupName].filter(Boolean).join(" · ") || user.email}
      />
      {user.blockedAt && (
        <Alert tone="danger" className="mb-6" title="Hesabınız bloklanıb">
          <span className="inline-flex gap-1"><ShieldAlert className="size-4 shrink-0" /> {user.blockedReason}. Bloku açmaq üçün kitabxana administratoruna müraciət edin.</span>
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <Card className="p-5 sm:p-7">
            <SectionTitle>Şəxsi və akademik məlumatlar</SectionTitle>
            <ProfileForm
              faculties={faculties}
              initial={{
                firstName: user.firstName ?? "", lastName: user.lastName ?? "", facultyId: user.facultyId ?? "", specialty: user.specialty ?? "",
                course: user.course ? String(user.course) : "", groupName: user.groupName ?? "", phone: user.phone ?? "", studentNumber: user.studentNumber ?? "", email: user.email,
              }}
            />
          </Card>
          {user.passwordHash && (
            <Card className="p-5 sm:p-7">
              <SectionTitle><span className="inline-flex items-center gap-2"><KeyRound className="size-5 text-brand-500" /> Şifrəni dəyiş</span></SectionTitle>
              <div className="max-w-md"><ChangePasswordForm /></div>
            </Card>
          )}
        </div>
        <aside className="space-y-4">
          <Card className="divide-y divide-brand-100 overflow-hidden">
            {[
              { href: "/rezervasiyalarim", label: "Aktiv rezervasiyalarım", icon: ListChecks },
              { href: "/tarixce", label: "Tarixçə", icon: History },
            ].map((l) => (
              <Link key={l.href} href={l.href} className="flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-brand-900 hover:bg-brand-50">
                <l.icon className="size-5 text-brand-500" /> <span className="flex-1">{l.label}</span> <ChevronRight className="size-4 text-brand-300" />
              </Link>
            ))}
          </Card>
          <Card className="p-5">
            <div className="mb-2 text-sm font-semibold text-brand-900">Hesab vəziyyəti</div>
            <KeyValue items={[
              ["Rol", <Badge key="r" tone="neutral">{ROLE_LABELS[user.role]}</Badge>],
              ["Xəbərdarlıq", <span key="s" className={user.noShowStrikes ? "text-danger" : ""}>{user.noShowStrikes} / {rules.noShowLimit}</span>],
              ["Otaqdan istifadə", roomCount],
              ["Qaytarılmış avadanlıq", eqCount],
              ["Son giriş", user.lastLoginAt ? fmtDateTime(user.lastLoginAt) : "—"],
            ]} />
            <p className="mt-3 text-xs text-brand-900/55">{rules.noShowLimit} dəfə rezerv edib gəlmədikdə hesab avtomatik bloklanır.</p>
          </Card>
        </aside>
      </div>
    </div>
  );
}
