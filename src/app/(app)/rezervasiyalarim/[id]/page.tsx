import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarPlus, CheckCircle2, Clock3, Crown, Download, MessageSquareText, QrCode, UserPlus } from "lucide-react";
import { cancelExtensionAction, cancelReservationAction, inviteAction, removeParticipantAction, respondInviteAction } from "@/app/actions/reservations";
import { Countdown } from "@/components/countdown";
import { ExtensionRequestForm } from "@/components/extension-form";
import { ConfirmSubmit, SubmitButton } from "@/components/submit-button";
import { Alert, Avatar, Badge, Card, KeyValue, LinkButton, SectionTitle, btn } from "@/components/ui";
import { getCurrentUser, isStaff, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { INVITE_STATUS, REQUEST_STATUS, RESERVATION_STATUS } from "@/lib/labels";
import { checkInWindow, requiredInvitees } from "@/lib/rules";
import { GROUP_MIN_MEMBERS, PARTY_LABELS, type PartyCategory } from "@/lib/rules-config";
import { getRules } from "@/lib/settings";
import { runSweep } from "@/lib/sweep";
import { dayKey, fmtDateTime, fmtDay, fmtDuration, fmtRange, fmtTime } from "@/lib/time";

export const metadata: Metadata = { title: "Rezervasiya" };

function outlookLink(subject: string, start: Date, end: Date, location: string) {
  const u = new URL("https://outlook.office.com/calendar/0/deeplink/compose");
  u.searchParams.set("subject", subject);
  u.searchParams.set("startdt", start.toISOString());
  u.searchParams.set("enddt", end.toISOString());
  u.searchParams.set("location", location);
  u.searchParams.set("path", "/calendar/action/compose");
  return u.toString();
}

export default async function ReservationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser({ next: `/rezervasiyalarim/${id}` });
  await runSweep();
  const r = await db.reservation.findUnique({
    where: { id },
    include: {
      room: { include: { library: true, photos: { take: 1, orderBy: { sortOrder: "asc" } } } },
      participants: { include: { user: true }, orderBy: [{ role: "asc" }, { invitedAt: "asc" }] },
      extensionRequests: { orderBy: { createdAt: "desc" } },
    },
  });
  const viewer = await getCurrentUser();
  const me = r?.participants.find((p) => p.userId === user.id);
  if (!r || (!me && !isStaff(viewer))) notFound();

  const rules = await getRules();
  const now = Date.now();
  const isOwner = r.ownerId === user.id;
  const st = RESERVATION_STATUS[r.status];
  const w = checkInWindow(r.startAt.getTime(), rules);
  const live = r.status === "BOOKED" || r.status === "ACTIVE";
  const windowOpen = live && now >= w.start && now <= w.end;
  const stillOpen = r.status === "BOOKED" || (r.status === "ACTIVE" && now < w.end);
  const checkedIn = r.participants.filter((p) => p.checkedInAt).length;
  const expected = Math.min(r.partyCategory, GROUP_MIN_MEMBERS);
  const activeGuests = r.participants.filter((p) => p.role === "GUEST" && p.inviteStatus !== "DECLINED").length;
  const need = requiredInvitees(r.partyCategory as PartyCategory);
  const pendingReq = r.extensionRequests.find((x) => x.status === "PENDING");
  const location = `${r.room.library.name} — ${r.room.name}`;
  const shortened = r.endAt < r.plannedEndAt;
  const extended = r.endAt > r.plannedEndAt;

  return (
    <div className="mx-auto max-w-5xl">
      <Link href="/rezervasiyalarim" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-brand-600 hover:underline">
        <ArrowLeft className="size-4" /> Rezervasiyalarım
      </Link>

      <Card className="overflow-hidden">
        <div className="grid sm:grid-cols-[220px_1fr]">
          <div className="relative h-44 sm:h-auto">
            {r.room.photos[0] && <Image src={r.room.photos[0].url} alt={r.room.name} fill sizes="220px" className="object-cover" />}
          </div>
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={st.tone}>{st.label}</Badge>
              <Badge tone="neutral">{PARTY_LABELS[r.partyCategory as PartyCategory]}{r.headcount && r.partyCategory === 4 ? ` (${r.headcount})` : ""}</Badge>
              {shortened && <Badge tone="warning">Qısaldılıb</Badge>}
              {extended && <Badge tone="success">Uzadılıb</Badge>}
            </div>
            <h1 className="mt-2 text-2xl font-semibold text-brand-900">{r.room.name}{r.room.code ? ` · ${r.room.code}` : ""}</h1>
            <div className="text-brand-900/65">{r.room.library.name}, {r.room.library.building}</div>
            <div className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
              <div><div className="text-brand-900/55">Tarix</div><div className="font-semibold text-brand-900">{fmtDay(dayKey(r.startAt))}</div></div>
              <div><div className="text-brand-900/55">Vaxt</div><div className="font-semibold text-brand-900">{fmtRange(r.startAt, r.endAt)}</div></div>
              <div><div className="text-brand-900/55">Müddət</div><div className="font-semibold text-brand-900">{fmtDuration(Math.round((r.endAt.getTime() - r.startAt.getTime()) / 60000))}</div></div>
            </div>
            {r.purpose && <p className="mt-3 text-sm text-brand-900/70">Məqsəd: {r.purpose}</p>}
          </div>
        </div>
      </Card>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          {/* QR təsdiqi */}
          {live && (
            <Card className={windowOpen && !me?.checkedInAt ? "p-5 ring-2 ring-brand-500" : "p-5"}>
              <SectionTitle>Giriş təsdiqi (QR)</SectionTitle>
              {me?.checkedInAt ? (
                <Alert tone="success" title="Siz girişi təsdiqləmisiniz">{fmtTime(me.checkedInAt)}-da QR kod skan edilib.</Alert>
              ) : windowOpen ? (
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-mint/60 p-4">
                  <div>
                    <div className="font-semibold text-brand-900">Otaqdakı QR kodu indi skan edin</div>
                    <div className="text-sm text-brand-900/70">Qalan vaxt: <Countdown target={w.end} className="font-semibold tabular-nums" doneText="bitdi" /></div>
                  </div>
                  <LinkButton href="/skan" size="lg"><QrCode className="size-5" /> Skan et</LinkButton>
                </div>
              ) : now < w.start ? (
                <p className="text-sm text-brand-900/70">
                  QR təsdiqi <b>{fmtTime(new Date(w.start))}–{fmtTime(new Date(w.end))}</b> arasında mümkün olacaq. Təsdiq edilməsə rezervasiya avtomatik ləğv olunur və xəbərdarlıq yazılır.
                </p>
              ) : (
                <p className="text-sm text-brand-900/70">QR təsdiq pəncərəsi bağlanıb.</p>
              )}
              {r.partyCategory > 1 && (
                <div className="mt-4">
                  <div className="mb-1 flex justify-between text-xs text-brand-900/60"><span>Skan edən nəfər</span><span className="font-semibold">{checkedIn} / {expected}{r.partyCategory === 4 ? "+" : ""}</span></div>
                  <div className="h-2 overflow-hidden rounded-full bg-brand-100"><div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${Math.min(100, (checkedIn / expected) * 100)}%` }} /></div>
                  <p className="mt-2 text-xs text-brand-900/55">Pəncərə bağlananda müddət skan edənlərin sayına görə yenidən hesablanır (1 nəfər — {fmtDuration(rules.soloMaxMinutes)}, 2 — {fmtDuration(rules.duoMaxMinutes)}, 3 — {fmtDuration(rules.trioMaxMinutes)}, 4+ — {fmtDuration(rules.groupMaxMinutes)}).</p>
                </div>
              )}
            </Card>
          )}

          {/* İştirakçılar */}
          <Card className="p-5">
            <SectionTitle>İştirakçılar</SectionTitle>
            <ul className="divide-y divide-brand-100">
              {r.participants.map((p) => {
                const inv = INVITE_STATUS[p.inviteStatus];
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 py-3">
                    <Avatar name={p.user.name} email={p.user.email} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 truncate font-medium text-brand-900">
                        {p.user.name ?? p.user.email}
                        {p.role === "OWNER" && <Crown className="size-3.5 text-[#b39a1c]" aria-label="Rezervasiya sahibi" />}
                        {p.userId === user.id && <span className="text-xs font-normal text-brand-900/50">(siz)</span>}
                      </div>
                      <div className="truncate text-xs text-brand-900/55">{p.user.email}</div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {p.role === "GUEST" && <Badge tone={inv.tone}>{inv.label}</Badge>}
                      {p.checkedInAt ? <Badge tone="success"><CheckCircle2 className="size-3" /> {fmtTime(p.checkedInAt)}</Badge> : live && <Badge tone="neutral">Skan edilməyib</Badge>}
                      {isOwner && p.role === "GUEST" && !p.checkedInAt && stillOpen && (
                        <form action={removeParticipantAction}>
                          <input type="hidden" name="reservationId" value={r.id} />
                          <input type="hidden" name="participantId" value={p.id} />
                          <ConfirmSubmit question="Çıxarılsın?" confirmText="Çıxar" size="sm">Çıxar</ConfirmSubmit>
                        </form>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
            {isOwner && stillOpen && activeGuests < r.room.capacity - 1 && (
              <form action={inviteAction} className="mt-4 flex flex-col gap-2 rounded-2xl bg-brand-50/70 p-3 sm:flex-row">
                <input type="hidden" name="reservationId" value={r.id} />
                <input name="email" type="email" required placeholder="ad.soyad@qu.edu.az" className="field-input flex-1 text-sm" aria-label="Dəvət olunacaq e-poçt" />
                <SubmitButton variant="secondary" pendingText="Göndərilir…"><UserPlus className="size-4" /> Dəvət et</SubmitButton>
              </form>
            )}
            {isOwner && stillOpen && activeGuests < need && (
              <p className="mt-2 text-xs text-[#6b5d12]">Qrup kateqoriyası üçün {need} dəvət lazımdır — rədd edənlərin yerinə başqasını dəvət edə bilərsiniz.</p>
            )}
            {me?.role === "GUEST" && me.inviteStatus === "PENDING" && stillOpen && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-cream/60 p-4">
                <span className="text-sm font-medium text-brand-900">Bu rezervasiyaya dəvət olunmusunuz</span>
                <div className="flex gap-2">
                  <form action={respondInviteAction}><input type="hidden" name="reservationId" value={r.id} /><input type="hidden" name="accept" value="0" /><SubmitButton variant="ghost" size="sm">Rədd et</SubmitButton></form>
                  <form action={respondInviteAction}><input type="hidden" name="reservationId" value={r.id} /><input type="hidden" name="accept" value="1" /><SubmitButton size="sm">Qəbul et</SubmitButton></form>
                </div>
              </div>
            )}
            {me?.role === "GUEST" && me.inviteStatus === "ACCEPTED" && !me.checkedInAt && r.status === "BOOKED" && (
              <form action={respondInviteAction} className="mt-4">
                <input type="hidden" name="reservationId" value={r.id} /><input type="hidden" name="accept" value="0" />
                <ConfirmSubmit question="Rezervasiyadan çıxmaq istəyirsiniz?" confirmText="Çıx">Rezervasiyadan çıx</ConfirmSubmit>
              </form>
            )}
          </Card>

          {/* Əlavə vaxt */}
          {isOwner && (live || r.extensionRequests.length > 0) && (
            <Card className="p-5">
              <SectionTitle><span className="inline-flex items-center gap-2"><MessageSquareText className="size-5 text-brand-500" /> Əlavə vaxt müraciəti</span></SectionTitle>
              {r.extensionRequests.length > 0 && (
                <ul className="mb-4 space-y-2">
                  {r.extensionRequests.map((q) => (
                    <li key={q.id} className="rounded-xl bg-brand-50/60 p-3 text-sm">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-semibold text-brand-900">+{q.minutes} dəq · {fmtDateTime(q.createdAt)}</span>
                        <Badge tone={REQUEST_STATUS[q.status].tone}>{REQUEST_STATUS[q.status].label}</Badge>
                      </div>
                      <p className="mt-1 text-brand-900/75">{q.reason}</p>
                      {q.adminNote && <p className="mt-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs text-brand-900"><b>Administrator:</b> {q.adminNote}</p>}
                      {q.status === "PENDING" && (
                        <form action={cancelExtensionAction} className="mt-2">
                          <input type="hidden" name="requestId" value={q.id} /><input type="hidden" name="reservationId" value={r.id} />
                          <SubmitButton variant="ghost" size="sm">Geri çək</SubmitButton>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {live && !pendingReq && r.endAt.getTime() > now && (
                <>
                  <p className="mb-3 text-sm text-brand-900/65">Daha çox vaxt lazımdırsa, səbəbini yazın. Administrator həmin vaxt boşdursa müraciəti təsdiqləyəcək.</p>
                  <ExtensionRequestForm reservationId={r.id} maxMinutes={rules.extensionRequestMaxMinutes} />
                </>
              )}
            </Card>
          )}
        </div>

        <aside className="space-y-4">
          {live && (
            <Card className="p-5">
              <div className="mb-3 flex items-center gap-2 font-semibold text-brand-900"><CalendarPlus className="size-5 text-brand-500" /> Təqvim</div>
              <p className="mb-3 text-xs text-brand-900/60">Təqvim dəvəti e-poçtunuza göndərilib. Lazım olarsa əl ilə də əlavə edə bilərsiniz.</p>
              <div className="flex flex-col gap-2">
                <a href={outlookLink(`Kitabxana: ${r.room.name}`, r.startAt, r.endAt, location)} target="_blank" rel="noopener" className={btn("outline", "sm")}>Outlook təqviminə əlavə et</a>
                <a href={`/api/ics/otaq/${r.id}`} className={btn("ghost", "sm")}><Download className="size-4" /> .ics faylı yüklə</a>
              </div>
            </Card>
          )}
          <Card className="p-5">
            <div className="mb-1 font-semibold text-brand-900">Ətraflı</div>
            <KeyValue items={[
              ["Rezerv edilib", fmtDateTime(r.createdAt)],
              ["İlkin bitmə", fmtTime(r.plannedEndAt)],
              ...(r.cancelledAt ? [["Ləğv edilib", fmtDateTime(r.cancelledAt)] as [string, string]] : []),
              ...(r.cancelReason ? [["Səbəb", r.cancelReason] as [string, string]] : []),
            ]} />
          </Card>
          {isOwner && live && (
            <Card className="p-5">
              <div className="mb-2 flex items-center gap-2 font-semibold text-brand-900"><Clock3 className="size-5 text-brand-500" /> {r.status === "ACTIVE" ? "Otağı erkən boşalt" : "Rezervasiyanı ləğv et"}</div>
              <p className="mb-3 text-xs text-brand-900/60">
                {r.status === "ACTIVE" ? "İşiniz bitibsə otağı boşaldın — qalan vaxt növbədə olanlara təqdim olunacaq." : "Gələ bilməyəcəksinizsə ləğv edin — bu, xəbərdarlıq sayılmır və vaxt başqalarına açılır."}
              </p>
              <form action={cancelReservationAction}>
                <input type="hidden" name="reservationId" value={r.id} />
                <ConfirmSubmit question="Əminsiniz?" confirmText={r.status === "ACTIVE" ? "Boşalt" : "Ləğv et"}>{r.status === "ACTIVE" ? "Otağı boşalt" : "Ləğv et"}</ConfirmSubmit>
              </form>
            </Card>
          )}
        </aside>
      </div>
    </div>
  );
}
