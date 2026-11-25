import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, KeyRound, ShieldBan, ShieldCheck } from "lucide-react";
import { blockUserAction, resetPasswordAction, setRoleAction, unblockUserAction } from "@/app/actions/admin";
import { StateForm } from "@/components/admin-ui";
import { ModalButton } from "@/components/modal";
import { ConfirmSubmit, SubmitButton } from "@/components/submit-button";
import { Alert, Avatar, Badge, Card, KeyValue, PageHeader, SectionTitle, Stat } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { BLOCK_REASON_LABELS } from "@/lib/blocks";
import { db } from "@/lib/db";
import { EQUIPMENT_STATUS, RESERVATION_STATUS, ROLE_LABELS, USER_TYPE_LABELS } from "@/lib/labels";
import { getRules } from "@/lib/settings";
import { COURSE_LABEL } from "@/lib/analytics";
import { dayKey, fmtDateTime, fmtDay, fmtRange } from "@/lib/time";

export const metadata: Metadata = { title: "İstifadəçi" };

export default async function UserDetail({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaff();
  const { id } = await params;
  const u = await db.user.findUnique({ where: { id }, include: { blocks: { orderBy: { createdAt: "desc" } }, library: true } });
  if (!u) notFound();
  const rules = await getRules();
  const [rooms, equipment, libraries] = await Promise.all([
    db.reservation.findMany({ where: { participants: { some: { userId: id } } }, include: { room: { include: { library: true } }, participants: { where: { userId: id } } }, orderBy: { startAt: "desc" }, take: 60 }),
    db.equipmentReservation.findMany({ where: { userId: id }, include: { equipment: { include: { library: true } } }, orderBy: { startAt: "desc" }, take: 40 }),
    ctx.superAdmin ? db.library.findMany({ where: { archivedAt: null }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }) : Promise.resolve([]),
  ]);
  const visits = rooms.filter((r) => r.participants[0]?.checkedInAt).length;
  const hours = rooms.filter((r) => r.participants[0]?.checkedInAt).reduce((s, r) => s + (r.endAt.getTime() - r.startAt.getTime()) / 3600_000, 0);
  const noShows = rooms.filter((r) => r.status === "NO_SHOW" && r.ownerId === id).length;
  const canReset = u.passwordHash !== null && u.id !== ctx.user.id && (u.role === "STUDENT" || ctx.superAdmin);

  return (
    <div>
      <Link href="/admin/istifadeciler" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"><ArrowLeft className="size-4" /> İstifadəçilər</Link>
      <PageHeader
        title={<span className="flex items-center gap-3"><Avatar name={u.name} email={u.email} size={44} /> {u.name ?? u.email}</span>}
        subtitle={u.email}
        actions={<><Badge tone={u.role === "STUDENT" ? "neutral" : "brand"}>{ROLE_LABELS[u.role]}{u.library ? ` · ${u.library.shortName}` : ""}</Badge>{u.blockedAt ? <Badge tone="danger">Bloklanıb</Badge> : <Badge tone="success">Aktiv</Badge>}</>}
      />
      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Otaqdan istifadə" value={visits} hint="QR ilə təsdiqlənmiş" />
        <Stat label="Ümumi saat" value={Math.round(hours * 10) / 10} tone="mint" />
        <Stat label="Gəlməmə" value={noShows} tone={noShows ? "danger" : "brand"} />
        <Stat label="Avadanlıq" value={equipment.filter((e) => e.status === "RETURNED").length} tone="sky" hint="qaytarılmış" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle>Profil</SectionTitle>
            <KeyValue items={[
              ["Ad, soyad", u.firstName || u.lastName ? `${u.firstName ?? ""} ${u.lastName ?? ""}` : "—"],
              ["Status", u.userType ? USER_TYPE_LABELS[u.userType] : "—"],
              ["Fakültə", u.faculty ?? "—"],
              ["İxtisas", u.specialty ?? "—"],
              ["Kurs", u.course ? COURSE_LABEL(u.course) : "—"],
              ["Qrup", u.groupName ?? "—"],
              ["Tələbə bileti", u.studentNumber ?? "—"],
              ["Telefon", u.phone ?? "—"],
              ["Qeydiyyat", fmtDateTime(u.createdAt)],
              ["Son giriş", u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "—"],
            ]} />
          </Card>
          <Card className="p-5">
            <SectionTitle>Otaq rezervasiyaları tarixçəsi</SectionTitle>
            {rooms.length === 0 ? <p className="text-sm text-brand-900/55">Rezervasiya yoxdur.</p> : (
              <ul className="divide-y divide-brand-100 text-sm">
                {rooms.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>{fmtDay(dayKey(r.startAt), { weekday: false })}, {fmtRange(r.startAt, r.endAt)} · {r.room.name} ({r.room.library.shortName}){r.ownerId !== u.id && <span className="text-brand-900/50"> · dəvətli</span>}{r.participants[0]?.checkedInAt && <span className="text-brand-600"> · QR ✓</span>}</span>
                    <Badge tone={RESERVATION_STATUS[r.status].tone}>{RESERVATION_STATUS[r.status].label}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-5">
            <SectionTitle>Avadanlıq tarixçəsi</SectionTitle>
            {equipment.length === 0 ? <p className="text-sm text-brand-900/55">Rezervasiya yoxdur.</p> : (
              <ul className="divide-y divide-brand-100 text-sm">
                {equipment.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>{fmtDay(dayKey(r.startAt), { weekday: false })}, {fmtRange(r.startAt, r.endAt)} · {r.equipment.assetTag} ({r.equipment.library.shortName}){r.returnedAt ? ` · qaytarıldı ${fmtDateTime(r.returnedAt)}` : ""}</span>
                    <Badge tone={EQUIPMENT_STATUS[r.status].tone}>{EQUIPMENT_STATUS[r.status].label}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
        <aside className="space-y-4">
          <Card className="p-5">
            <SectionTitle>Hesab vəziyyəti</SectionTitle>
            <div className="mb-3 text-sm text-brand-900/70">Xəbərdarlıq: <b className={u.noShowStrikes ? "text-danger" : ""}>{u.noShowStrikes} / {rules.noShowLimit}</b></div>
            {u.blockedAt ? (
              <>
                <Alert tone="danger" title={`Bloklanıb · ${fmtDateTime(u.blockedAt)}`}>{u.blockedReason}</Alert>
                <form action={unblockUserAction} className="mt-3 space-y-2">
                  <input type="hidden" name="userId" value={u.id} />
                  <input name="note" placeholder="Qeyd (məs. izahat alındı)" className="field-input text-sm" />
                  <SubmitButton className="w-full"><ShieldCheck className="size-4" /> Bloku aç</SubmitButton>
                  <p className="text-xs text-brand-900/55">Blok açıldıqda xəbərdarlıq sayı sıfırlanır.</p>
                </form>
              </>
            ) : u.role === "STUDENT" ? (
              <form action={blockUserAction} className="space-y-2">
                <input type="hidden" name="userId" value={u.id} />
                <input name="note" required placeholder="Bloklama səbəbi" className="field-input text-sm" />
                <ConfirmSubmit question="Bloklansın?" confirmText="Blokla"><ShieldBan className="size-4" /> Əl ilə blokla</ConfirmSubmit>
              </form>
            ) : null}
          </Card>
          {canReset && (
            <Card className="p-5">
              <SectionTitle>Şifrə</SectionTitle>
              <p className="mb-3 text-sm text-brand-900/65">İstifadəçi şifrəsini unudubsa, müvəqqəti şifrə yaradın. İlk girişdə yeni şifrə təyin etməli olacaq.</p>
              <ModalButton variant="secondary" size="sm" label={<><KeyRound className="size-4" /> Şifrəni sıfırla</>} title="Şifrəni sıfırla" description={`${u.name ?? u.email} — bütün aktiv sessiyalar bağlanacaq.`} modalSize="sm">
                <StateForm action={resetPasswordAction} submitLabel="Müvəqqəti şifrə yarat" submitVariant="danger">
                  <input type="hidden" name="userId" value={u.id} />
                </StateForm>
              </ModalButton>
            </Card>
          )}
          {ctx.superAdmin && u.id !== ctx.user.id && (
            <Card className="p-5">
              <SectionTitle>Rol və kitabxana</SectionTitle>
              <form action={setRoleAction} className="space-y-2">
                <input type="hidden" name="userId" value={u.id} />
                <select name="role" defaultValue={u.role} className="field-input text-sm">
                  <option value="STUDENT">{ROLE_LABELS.STUDENT}</option>
                  <option value="SUPERVISOR">{ROLE_LABELS.SUPERVISOR}</option>
                  <option value="SUPERADMIN">{ROLE_LABELS.SUPERADMIN}</option>
                </select>
                <select name="libraryId" defaultValue={u.libraryId ?? ""} className="field-input text-sm">
                  <option value="">Kitabxana (supervayzer üçün)</option>
                  {libraries.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
                </select>
                <SubmitButton variant="secondary" className="w-full">Yadda saxla</SubmitButton>
              </form>
              <p className="mt-2 text-xs text-brand-900/55">Supervayzer yalnız təyin olunduğu kitabxananı görür və idarə edir. Super admin bütün kitabxanaları və strukturu idarə edir.</p>
            </Card>
          )}
          {u.blocks.length > 0 && (
            <Card className="p-5">
              <SectionTitle>Blok tarixçəsi</SectionTitle>
              <ul className="space-y-2 text-sm">
                {u.blocks.map((b) => (
                  <li key={b.id} className="rounded-xl bg-brand-50/60 p-3">
                    <div className="font-medium text-brand-900">{BLOCK_REASON_LABELS[b.reason]}</div>
                    {b.note && <div className="text-brand-900/70">{b.note}</div>}
                    <div className="mt-1 text-xs text-brand-900/50">{fmtDateTime(b.createdAt)}{b.liftedAt ? ` · açılıb ${fmtDateTime(b.liftedAt)}` : ""}</div>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
