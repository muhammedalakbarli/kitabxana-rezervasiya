import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ShieldBan, ShieldCheck } from "lucide-react";
import { blockUserAction, setRoleAction, unblockUserAction } from "@/app/actions/admin";
import { ConfirmSubmit, SubmitButton } from "@/components/submit-button";
import { Alert, Avatar, Badge, Card, KeyValue, PageHeader, SectionTitle } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { BLOCK_REASON_LABELS } from "@/lib/blocks";
import { db } from "@/lib/db";
import { EQUIPMENT_STATUS, RESERVATION_STATUS, ROLE_LABELS, USER_TYPE_LABELS } from "@/lib/labels";
import { getRules } from "@/lib/settings";
import { dayKey, fmtDateTime, fmtDay, fmtRange } from "@/lib/time";

export const metadata: Metadata = { title: "İstifadəçi" };

export default async function UserDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireStaff();
  const { id } = await params;
  const u = await db.user.findUnique({ where: { id }, include: { blocks: { orderBy: { createdAt: "desc" } } } });
  if (!u) notFound();
  const rules = await getRules();
  const [rooms, equipment] = await Promise.all([
    db.reservation.findMany({ where: { participants: { some: { userId: id } } }, include: { room: { include: { library: true } } }, orderBy: { startAt: "desc" }, take: 25 }),
    db.equipmentReservation.findMany({ where: { userId: id }, include: { equipment: true }, orderBy: { startAt: "desc" }, take: 25 }),
  ]);
  const stats = {
    total: rooms.length,
    noShow: rooms.filter((r) => r.status === "NO_SHOW").length,
    completed: rooms.filter((r) => r.status === "COMPLETED").length,
  };

  return (
    <div>
      <Link href="/admin/istifadeciler" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline"><ArrowLeft className="size-4" /> İstifadəçilər</Link>
      <PageHeader
        title={<span className="flex items-center gap-3"><Avatar name={u.name} email={u.email} size={44} /> {u.name ?? u.email}</span>}
        subtitle={u.email}
        actions={<><Badge tone={u.role === "STUDENT" ? "neutral" : "brand"}>{ROLE_LABELS[u.role]}</Badge>{u.blockedAt ? <Badge tone="danger">Bloklanıb</Badge> : <Badge tone="success">Aktiv</Badge>}</>}
      />
      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Card className="p-5">
            <SectionTitle>Profil</SectionTitle>
            <KeyValue items={[
              ["Status", u.userType ? USER_TYPE_LABELS[u.userType] : "—"],
              ["Fakültə", u.faculty ?? "—"],
              ["İxtisas", u.specialty ?? "—"],
              ["Qrup / kurs", `${u.groupName ?? "—"}${u.course ? ` · ${u.course}-ci kurs` : ""}`],
              ["Struktur bölmə", u.department ?? "—"],
              ["Tələbə bileti", u.studentNumber ?? "—"],
              ["Telefon", u.phone ?? "—"],
              ["Qeydiyyat", fmtDateTime(u.createdAt)],
              ["Son giriş", u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "—"],
            ]} />
          </Card>
          <Card className="p-5">
            <SectionTitle>Otaq rezervasiyaları <span className="ml-2 text-sm font-normal text-brand-900/55">{stats.completed} istifadə · {stats.noShow} gəlməmə</span></SectionTitle>
            {rooms.length === 0 ? <p className="text-sm text-brand-900/55">Rezervasiya yoxdur.</p> : (
              <ul className="divide-y divide-brand-100 text-sm">
                {rooms.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>{fmtDay(dayKey(r.startAt), { weekday: false })}, {fmtRange(r.startAt, r.endAt)} · {r.room.name} ({r.room.library.shortName}){r.ownerId !== u.id && <span className="text-brand-900/50"> · dəvətli</span>}</span>
                    <Badge tone={RESERVATION_STATUS[r.status].tone}>{RESERVATION_STATUS[r.status].label}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="p-5">
            <SectionTitle>Avadanlıq</SectionTitle>
            {equipment.length === 0 ? <p className="text-sm text-brand-900/55">Rezervasiya yoxdur.</p> : (
              <ul className="divide-y divide-brand-100 text-sm">
                {equipment.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <span>{fmtDay(dayKey(r.startAt), { weekday: false })}, {fmtRange(r.startAt, r.endAt)} · {r.equipment.assetTag}{r.returnedAt ? ` · qaytarıldı ${fmtDateTime(r.returnedAt)}` : ""}</span>
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
            ) : (
              <form action={blockUserAction} className="space-y-2">
                <input type="hidden" name="userId" value={u.id} />
                <input name="note" required placeholder="Bloklama səbəbi" className="field-input text-sm" />
                <ConfirmSubmit question="Bloklansın?" confirmText="Blokla"><ShieldBan className="size-4" /> Əl ilə blokla</ConfirmSubmit>
              </form>
            )}
          </Card>
          {me.role === "ADMIN" && (
            <Card className="p-5">
              <SectionTitle>Rol</SectionTitle>
              <form action={setRoleAction} className="flex gap-2">
                <input type="hidden" name="userId" value={u.id} />
                <select name="role" defaultValue={u.role} className="field-input text-sm">
                  <option value="STUDENT">{ROLE_LABELS.STUDENT}</option>
                  <option value="STAFF">{ROLE_LABELS.STAFF}</option>
                  <option value="ADMIN">{ROLE_LABELS.ADMIN}</option>
                </select>
                <SubmitButton variant="secondary">Saxla</SubmitButton>
              </form>
              <p className="mt-2 text-xs text-brand-900/55">Kitabxana əməkdaşı rezervasiyaları, müraciətləri və avadanlıq masasını idarə edir. Administrator əlavə olaraq qaydaları və kitabxanaları dəyişir.</p>
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
