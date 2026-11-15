import type { Metadata } from "next";
import { ShieldAlert, Sparkles } from "lucide-react";
import { ProfileForm } from "./profile-form";
import { Alert, Badge, Card, KeyValue, PageHeader } from "@/components/ui";
import { requireUser, safeNext } from "@/lib/auth";
import { getRules } from "@/lib/settings";
import { ROLE_LABELS } from "@/lib/labels";
import { fmtDateTime } from "@/lib/time";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Profil" };

export default async function ProfilePage({ searchParams }: { searchParams: Promise<{ ilk?: string; next?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser({ allowIncompleteProfile: true, next: "/profil" });
  const first = !user.profileCompletedAt;
  const rules = await getRules();
  const [roomCount, eqCount] = await Promise.all([
    db.reservation.count({ where: { ownerId: user.id, status: { in: ["COMPLETED", "ACTIVE"] } } }),
    db.equipmentReservation.count({ where: { userId: user.id, status: "RETURNED" } }),
  ]);

  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader
        eyebrow={first ? "Son addım" : "Hesab"}
        title={first ? "Məlumatlarınızı tamamlayın" : "Profilim"}
        subtitle={first ? "Rezervasiya üçün fakültə, ixtisas, qrup və kurs məlumatlarınızı bir dəfə qeyd edin. Universitet sistemi ilə inteqrasiyadan sonra bu məlumatlar avtomatik doldurulacaq." : "Şəxsi və akademik məlumatlarınız."}
      />
      {first && (
        <Alert tone="info" className="mb-6" title="Xoş gəlmisiniz!">
          <span className="inline-flex items-center gap-1"><Sparkles className="size-4" /> Bu məlumatlar yalnız kitabxana xidmətləri üçün istifadə olunur.</span>
        </Alert>
      )}
      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <Card className="p-5 sm:p-7">
          <ProfileForm
            first={first}
            next={safeNext(sp.next)}
            initial={{
              name: user.name ?? "", userType: user.userType ?? "STUDENT", faculty: user.faculty ?? "", specialty: user.specialty ?? "",
              groupName: user.groupName ?? "", course: user.course ? String(user.course) : "", studentNumber: user.studentNumber ?? "",
              department: user.department ?? "", phone: user.phone ?? "", email: user.email,
            }}
          />
        </Card>
        {!first && (
          <div className="space-y-4">
            {user.blockedAt && (
              <Alert tone="danger" title="Hesab bloklanıb">
                <span className="inline-flex gap-1"><ShieldAlert className="size-4 shrink-0" /> {user.blockedReason}</span>
              </Alert>
            )}
            <Card className="p-5">
              <div className="mb-2 text-sm font-semibold text-brand-900">Hesab vəziyyəti</div>
              <KeyValue
                items={[
                  ["Rol", <Badge key="r" tone="neutral">{ROLE_LABELS[user.role]}</Badge>],
                  ["Xəbərdarlıq", <span key="s" className={user.noShowStrikes ? "text-danger" : ""}>{user.noShowStrikes} / {rules.noShowLimit}</span>],
                  ["İstifadə olunmuş otaq", roomCount],
                  ["Qaytarılmış avadanlıq", eqCount],
                  ["Son giriş", user.lastLoginAt ? fmtDateTime(user.lastLoginAt) : "—"],
                ]}
              />
              <p className="mt-3 text-xs text-brand-900/55">{rules.noShowLimit} dəfə rezerv edib gəlmədikdə hesab avtomatik bloklanır.</p>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
