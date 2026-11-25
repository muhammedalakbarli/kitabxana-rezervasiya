import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { AlertOctagon, ArrowRight, CalendarPlus, DoorOpen, Laptop, QrCode, Users } from "lucide-react";
import { Countdown } from "@/components/countdown";
import { EquipmentReservationCard, RoomReservationCard, WaitlistCard } from "@/components/reservation-cards";
import { BrandPattern } from "@/components/pattern";
import { Alert, Badge, Card, EmptyState, LinkButton, SectionTitle } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { userEquipmentReservations, userRoomReservations, userWaitlist } from "@/lib/queries";
import { checkInWindow } from "@/lib/rules";
import { getRules } from "@/lib/settings";
import { runSweep } from "@/lib/sweep";
import { dayKey, fmtDay, fmtRange, fmtTime } from "@/lib/time";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Panel" };

export default async function DashboardPage() {
  const user = await requireUser({ next: "/panel" });
  await runSweep();
  const rules = await getRules();
  const [rooms, equipment, waitlist, libraries] = await Promise.all([
    userRoomReservations(user.id, "upcoming", 20),
    userEquipmentReservations(user.id, "upcoming", 10),
    userWaitlist(user.id),
    db.library.findMany({ where: { isActive: true }, orderBy: { sortOrder: "asc" }, select: { slug: true, shortName: true, coverPhoto: true } }),
  ]);
  const now = Date.now();
  const invites = rooms.filter((r) => r.participants.some((p) => p.userId === user.id && p.role === "GUEST" && p.inviteStatus === "PENDING"));
  const mine = rooms.filter((r) => !invites.includes(r));
  const next = mine[0];
  const nextWindow = next ? checkInWindow(next.startAt.getTime(), rules) : null;
  const nextMe = next?.participants.find((p) => p.userId === user.id);
  const windowOpen = nextWindow ? now >= nextWindow.start && now <= nextWindow.end : false;
  const hour = Number(fmtTime(new Date()).slice(0, 2));
  const greet = hour < 5 ? "Xoş gördük" : hour < 12 ? "Sabahınız xeyir" : hour < 18 ? "Günortanız xeyir" : "Axşamınız xeyir";
  const firstName = user.name?.split(" ")[0];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="text-sm text-brand-900/60">{fmtDay(dayKey(new Date()))}</div>
          <h1 className="text-2xl font-semibold tracking-tight text-brand-900 sm:text-[28px]">{greet}{firstName ? `, ${firstName}` : ""}!</h1>
        </div>
        <div className="flex gap-2">
          <LinkButton href="/rezerv"><CalendarPlus className="size-4" /> Otaq rezerv et</LinkButton>
          <LinkButton href="/avadanliq" variant="secondary"><Laptop className="size-4" /> Avadanlıq</LinkButton>
        </div>
      </div>

      {user.blockedAt ? (
        <Alert tone="danger" title="Hesabınız müvəqqəti bloklanıb">
          Səbəb: {user.blockedReason}. Yeni rezervasiya etmək üçün kitabxana əməkdaşına müraciət edin — blok yalnız administrator tərəfindən açılır.
        </Alert>
      ) : user.noShowStrikes > 0 ? (
        <Alert tone="warning" title={`Xəbərdarlıq: ${user.noShowStrikes}/${rules.noShowLimit}`}>
          Rezerv edib gəlmədiyiniz üçün xəbərdarlıq almısınız. {rules.noShowLimit} xəbərdarlıqdan sonra hesab avtomatik bloklanır.
        </Alert>
      ) : null}

      {/* Növbəti rezervasiya */}
      {next ? (
        <section className="relative overflow-hidden rounded-3xl bg-brand-500 text-white shadow-lift">
          <BrandPattern className="absolute inset-0 h-full w-full text-white" opacity={0.14} />
          <div className="relative grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_auto] md:items-center">
            <div>
              <Badge tone="cream">{next.status === "ACTIVE" ? "İndi istifadədə" : "Növbəti rezervasiya"}</Badge>
              <h2 className="mt-3 text-2xl font-semibold sm:text-3xl">
                {next.room.name}{next.room.code ? ` · ${next.room.code}` : ""}
              </h2>
              <div className="mt-1 text-white/85">{next.room.library.name}</div>
              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm">
                <div><div className="text-white/60">Tarix</div><div className="font-semibold">{fmtDay(dayKey(next.startAt))}</div></div>
                <div><div className="text-white/60">Vaxt</div><div className="font-semibold">{fmtRange(next.startAt, next.endAt)}</div></div>
                <div><div className="text-white/60">İştirakçı</div><div className="inline-flex items-center gap-1 font-semibold"><Users className="size-4" /> {next.participants.filter((p) => p.inviteStatus === "ACCEPTED").length}</div></div>
              </div>
            </div>
            <div className="rounded-2xl bg-white/12 p-5 text-center ring-1 ring-white/20 backdrop-blur md:min-w-[240px]">
              {nextMe?.checkedInAt ? (
                <>
                  <QrCode className="mx-auto size-8 text-cream" />
                  <div className="mt-2 font-semibold">Giriş təsdiqlənib</div>
                  <div className="text-sm text-white/75">Bitmə: {fmtTime(next.endAt)}</div>
                </>
              ) : windowOpen ? (
                <>
                  <div className="text-sm text-white/80">QR təsdiqinə qalan vaxt</div>
                  <Countdown target={nextWindow!.end} className="mt-1 block text-3xl font-semibold tabular-nums" doneText="Vaxt bitdi" />
                  <LinkButton href="/skan" variant="light" className="mt-4 w-full"><QrCode className="size-4.5" /> QR kodu skan et</LinkButton>
                </>
              ) : (
                <>
                  <div className="text-sm text-white/80">Başlamağa qalıb</div>
                  <Countdown target={next.startAt.getTime()} className="mt-1 block text-3xl font-semibold tabular-nums" />
                  <div className="mt-3 text-xs text-white/75">QR təsdiqi {fmtTime(new Date(nextWindow!.start))}–{fmtTime(new Date(nextWindow!.end))} arasında</div>
                  <LinkButton href={`/rezervasiyalarim/${next.id}`} variant="light" size="sm" className="mt-3 w-full">Ətraflı</LinkButton>
                </>
              )}
            </div>
          </div>
        </section>
      ) : (
        <Card className="overflow-hidden">
          <div className="grid items-center gap-6 p-6 sm:grid-cols-[1fr_auto] sm:p-8">
            <div>
              <h2 className="text-xl font-semibold text-brand-900">Aktiv rezervasiyanız yoxdur</h2>
              <p className="mt-1 text-sm text-brand-900/65">Binanızı seçin və fərdi oxu otağını və ya noutbuku bir neçə saniyəyə rezerv edin.</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {libraries.map((l) => (
                  <LinkButton key={l.slug} href={`/rezerv?k=${l.slug}`} variant="secondary" size="sm"><DoorOpen className="size-4" /> {l.shortName}</LinkButton>
                ))}
              </div>
            </div>
            <div className="hidden gap-2 sm:flex">
              {libraries.slice(0, 2).map((l) => l.coverPhoto && (
                <div key={l.slug} className="relative h-28 w-20 overflow-hidden rounded-2xl"><Image src={l.coverPhoto} alt="" fill sizes="80px" className="object-cover" /></div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {invites.length > 0 && (
        <section>
          <SectionTitle>Dəvətlər <Badge tone="warning" className="ml-1">{invites.length}</Badge></SectionTitle>
          <div className="space-y-3">{invites.map((r) => <RoomReservationCard key={r.id} r={r} userId={user.id} />)}</div>
        </section>
      )}

      {waitlist.length > 0 && (
        <section>
          <SectionTitle>Növbə</SectionTitle>
          <div className="space-y-3">{waitlist.map((w) => <WaitlistCard key={w.id} w={w} back="/panel" />)}</div>
        </section>
      )}

      <div className="grid gap-8 lg:grid-cols-2">
        <section>
          <SectionTitle action={<Link href="/tarixce" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-600">Tarixçə <ArrowRight className="size-4" /></Link>}>Otaq rezervasiyaları</SectionTitle>
          {mine.length ? (
            <div className="space-y-3">
              {mine.slice(0, 4).map((r) => {
                const w = checkInWindow(r.startAt.getTime(), rules);
                return <RoomReservationCard key={r.id} r={r} userId={user.id} checkInOpen={now >= w.start && now <= w.end} />;
              })}
            </div>
          ) : (
            <EmptyState icon={<DoorOpen />} title="Gələcək otaq rezervasiyası yoxdur" action={<LinkButton href="/rezerv" size="sm">Otaq seç</LinkButton>} />
          )}
        </section>
        <section>
          <SectionTitle>Avadanlıq</SectionTitle>
          {equipment.length ? (
            <div className="space-y-3">{equipment.map((r) => <EquipmentReservationCard key={r.id} r={r} />)}</div>
          ) : (
            <EmptyState icon={<Laptop />} title="Aktiv avadanlıq rezervasiyası yoxdur" action={<LinkButton href="/avadanliq" size="sm" variant="secondary">Noutbuk və ya adapter rezerv et</LinkButton>} />
          )}
        </section>
      </div>

      {user.blockedAt && (
        <p className="flex items-center gap-2 text-xs text-brand-900/50"><AlertOctagon className="size-4" /> Blok müddətində mövcud dəvətləri qəbul etmək mümkün deyil.</p>
      )}
    </div>
  );
}
