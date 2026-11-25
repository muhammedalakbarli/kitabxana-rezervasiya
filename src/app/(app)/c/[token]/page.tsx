import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { CheckCircle2, DoorOpen, Laptop, QrCode, XCircle } from "lucide-react";
import { checkInAction } from "@/app/actions/reservations";
import { selfPickupAction } from "@/app/actions/equipment";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Badge, Card, LinkButton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { lookupCheckIn } from "@/lib/reservations";
import { runSweep } from "@/lib/sweep";
import { dayKey, fmtRange, fmtTime } from "@/lib/time";

export const metadata: Metadata = { title: "Giriş təsdiqi" };

export default async function CheckInPage({ params }: { params: Promise<{ token: string }> }) {
  const { token: raw } = await params;
  const token = raw.toUpperCase();
  const user = await requireUser({ next: `/c/${token}` });
  await runSweep(true);

  const room = await db.room.findUnique({ where: { qrToken: token }, include: { library: true, photos: { take: 1, orderBy: { sortOrder: "asc" } } } });
  if (room) {
    const found = await lookupCheckIn(user, room);
    return (
      <div className="mx-auto max-w-md">
        <Card className="overflow-hidden">
          <div className="relative h-40 bg-brand-500">
            {room.photos[0] && <Image src={room.photos[0].url} alt="" fill sizes="448px" className="object-cover opacity-80" />}
            <div className="absolute inset-0 bg-gradient-to-t from-brand-900/90 to-brand-900/10" />
            <div className="absolute bottom-4 left-5 text-white">
              <div className="flex items-center gap-1.5 text-xs font-semibold tracking-wider text-cream uppercase"><DoorOpen className="size-4" /> {room.library.shortName}</div>
              <div className="text-2xl font-semibold">{room.name}{room.code ? ` · ${room.code}` : ""}</div>
            </div>
          </div>
          <div className="space-y-4 p-6">
            {found.kind === "ready" && (
              <>
                <div className="flex items-center gap-3">
                  <span className="grid size-12 place-items-center rounded-2xl bg-mint text-brand-700"><QrCode className="size-6" /></span>
                  <div>
                    <div className="font-semibold text-brand-900">Rezervasiyanız: {fmtRange(found.reservation.startAt, found.reservation.endAt)}</div>
                    <div className="text-sm text-brand-900/65">{found.pendingInvite ? "Təsdiq etməklə dəvəti də qəbul etmiş olursunuz." : "Otağa daxil olduğunuzu təsdiqləyin."}</div>
                  </div>
                </div>
                <form action={checkInAction}>
                  <input type="hidden" name="token" value={token} />
                  <SubmitButton size="lg" className="w-full" pendingText="Təsdiqlənir…"><CheckCircle2 className="size-5" /> Girişi təsdiqlə</SubmitButton>
                </form>
              </>
            )}
            {found.kind === "already" && (
              <>
                <Alert tone="success" title="Giriş artıq təsdiqlənib">Rezervasiya: {fmtRange(found.reservation.startAt, found.reservation.endAt)}</Alert>
                <LinkButton href={`/rezervasiyalarim/${found.reservation.id}`} variant="secondary" className="w-full">Rezervasiyaya bax</LinkButton>
              </>
            )}
            {found.kind === "early" && (
              <>
                <Alert tone="info" title="Hələ tezdir">QR təsdiqi {fmtTime(found.opensAt)}-dan etibarən mümkündür. Rezervasiya: {fmtRange(found.reservation.startAt, found.reservation.endAt)}.</Alert>
                <LinkButton href={`/rezervasiyalarim/${found.reservation.id}`} variant="secondary" className="w-full">Rezervasiyaya bax</LinkButton>
              </>
            )}
            {found.kind === "none" && (
              <>
                <Alert tone="warning" title="Təsdiqlənəcək rezervasiya tapılmadı">
                  <span className="inline-flex gap-1"><XCircle className="mt-0.5 size-4 shrink-0" /> Bu otaqda hazırda sizə aid rezervasiya yoxdur və ya QR təsdiq vaxtı bitib.</span>
                </Alert>
                {found.freeNow ? (
                  <LinkButton href={`/rezerv?k=${room.library.slug}&otaq=${room.slug}&gun=${dayKey(new Date())}`} className="w-full">Otaq hazırda boşdur — indi rezerv et</LinkButton>
                ) : (
                  <LinkButton href={`/rezerv?k=${room.library.slug}&otaq=${room.slug}`} variant="secondary" className="w-full">Otağın cədvəlinə bax</LinkButton>
                )}
              </>
            )}
          </div>
        </Card>
      </div>
    );
  }

  const eq = await db.equipment.findUnique({ where: { qrToken: token }, include: { library: true } });
  if (!eq) notFound();
  const booking = await db.equipmentReservation.findFirst({
    where: { equipmentId: eq.id, userId: user.id, status: { in: ["BOOKED", "ISSUED"] } },
    orderBy: { startAt: "asc" },
  });
  return (
    <div className="mx-auto max-w-md">
      <Card className="p-6">
        <div className="flex items-center gap-3">
          <span className="grid size-12 place-items-center rounded-2xl bg-sky text-brand-800"><Laptop className="size-6" /></span>
          <div>
            <div className="text-lg font-semibold text-brand-900">{eq.name}</div>
            <Badge tone="cream">ID: {eq.assetTag}</Badge>
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {booking?.status === "BOOKED" ? (
            <>
              <p className="text-sm text-brand-900/70">Rezervasiyanız: <b>{fmtRange(booking.startAt, booking.endAt)}</b>. Avadanlığı təhvil aldığınızı təsdiqləyin.</p>
              <form action={selfPickupAction}>
                <input type="hidden" name="token" value={token} />
                <SubmitButton size="lg" className="w-full">Təhvil aldım</SubmitButton>
              </form>
            </>
          ) : booking?.status === "ISSUED" ? (
            <Alert tone="success" title="Avadanlıq sizdədir">Qaytarma vaxtı: {fmtTime(booking.endAt)}</Alert>
          ) : (
            <Alert tone="warning">Bu avadanlıq üçün sizə aid aktiv rezervasiya yoxdur.</Alert>
          )}
          <LinkButton href={`/avadanliq?k=${eq.library.slug}&item=${eq.assetTag.toLowerCase()}`} variant="secondary" className="w-full">Avadanlığın cədvəli</LinkButton>
        </div>
      </Card>
    </div>
  );
}
