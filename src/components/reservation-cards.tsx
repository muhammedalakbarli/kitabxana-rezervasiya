import Image from "next/image";
import Link from "next/link";
import type { EquipmentReservation, Equipment, Library, WaitlistEntry, Room } from "@prisma/client";
import { BellRing, ChevronRight, Clock, Laptop, Plug, QrCode, Users } from "lucide-react";
import type { RoomReservationListItem } from "@/lib/queries";
import { EQUIPMENT_STATUS, INVITE_STATUS, RESERVATION_STATUS, WAITLIST_STATUS } from "@/lib/labels";
import { cancelWaitlistAction, respondInviteAction } from "@/app/actions/reservations";
import { dayKey, fmtDay, fmtRange, fmtTime } from "@/lib/time";
import { SubmitButton } from "./submit-button";
import { Badge, Card, LinkButton } from "./ui";

export function RoomReservationCard({ r, userId, checkInOpen }: { r: RoomReservationListItem; userId: string; checkInOpen?: boolean }) {
  const me = r.participants.find((p) => p.userId === userId);
  const pendingInvite = me?.role === "GUEST" && me.inviteStatus === "PENDING";
  const st = RESERVATION_STATUS[r.status];
  const accepted = r.participants.filter((p) => p.inviteStatus === "ACCEPTED").length;
  return (
    <Card className="overflow-hidden">
      <Link href={`/rezervasiyalarim/${r.id}`} className="flex gap-4 p-4 transition hover:bg-brand-50/50">
        <div className="relative hidden size-20 shrink-0 overflow-hidden rounded-xl bg-brand-50 sm:block">
          {r.room.photos[0] && <Image src={r.room.photos[0].url} alt="" fill sizes="80px" className="object-cover" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={st.tone}>{st.label}</Badge>
            {pendingInvite && <Badge tone="warning">Dəvət — cavab gözlənilir</Badge>}
            {me?.role === "GUEST" && !pendingInvite && <Badge tone="neutral">Dəvətli</Badge>}
            {me?.checkedInAt && <Badge tone="success"><QrCode className="size-3" /> Təsdiqlənib</Badge>}
          </div>
          <div className="mt-1.5 truncate font-semibold text-brand-900">
            {r.room.name}{r.room.code ? ` · ${r.room.code}` : ""} <span className="font-normal text-brand-900/55">— {r.room.library.shortName}</span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-brand-900/65">
            <span className="inline-flex items-center gap-1"><Clock className="size-3.5" /> {fmtDay(dayKey(r.startAt))}, {fmtRange(r.startAt, r.endAt)}</span>
            <span className="inline-flex items-center gap-1"><Users className="size-3.5" /> {accepted}/{r.partyCategory === 4 ? "4+" : r.partyCategory}</span>
          </div>
        </div>
        <ChevronRight className="size-5 shrink-0 self-center text-brand-300" />
      </Link>
      {pendingInvite && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-brand-100 bg-cream/40 px-4 py-2.5">
          <span className="text-sm text-brand-900">{r.owner.name ?? r.owner.email} sizi dəvət edir</span>
          <div className="flex gap-2">
            <form action={respondInviteAction}>
              <input type="hidden" name="reservationId" value={r.id} />
              <input type="hidden" name="accept" value="0" />
              <input type="hidden" name="back" value="/panel" />
              <SubmitButton size="sm" variant="ghost">Rədd et</SubmitButton>
            </form>
            <form action={respondInviteAction}>
              <input type="hidden" name="reservationId" value={r.id} />
              <input type="hidden" name="accept" value="1" />
              <input type="hidden" name="back" value="/panel" />
              <SubmitButton size="sm">Qəbul et</SubmitButton>
            </form>
          </div>
        </div>
      )}
      {checkInOpen && !me?.checkedInAt && !pendingInvite && (
        <div className="flex items-center justify-between gap-2 border-t border-brand-100 bg-mint/50 px-4 py-2.5">
          <span className="text-sm font-medium text-brand-900">QR təsdiq vaxtıdır!</span>
          <LinkButton href="/skan" size="sm"><QrCode className="size-4" /> Skan et</LinkButton>
        </div>
      )}
    </Card>
  );
}

export function EquipmentReservationCard({ r }: { r: EquipmentReservation & { equipment: Equipment & { library: Library } } }) {
  const st = EQUIPMENT_STATUS[r.status];
  const Icon = r.equipment.type === "LAPTOP" ? Laptop : Plug;
  return (
    <Card>
      <Link href={`/rezervasiyalarim/avadanliq/${r.id}`} className="flex items-center gap-4 p-4 transition hover:bg-brand-50/50">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-sky text-brand-800"><Icon className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={st.tone}>{st.label}</Badge>
            <span className="text-xs font-semibold tracking-wide text-brand-500">{r.equipment.assetTag}</span>
          </div>
          <div className="mt-1 truncate font-semibold text-brand-900">{r.equipment.name} <span className="font-normal text-brand-900/55">— {r.equipment.library.shortName}</span></div>
          <div className="text-sm text-brand-900/65">{fmtDay(dayKey(r.startAt))}, {fmtRange(r.startAt, r.endAt)}</div>
        </div>
        <ChevronRight className="size-5 shrink-0 text-brand-300" />
      </Link>
    </Card>
  );
}

export function WaitlistCard({ w, back }: { w: WaitlistEntry & { library: Library; room: Room | null; holdRoom: Room | null }; back: string }) {
  const st = WAITLIST_STATUS[w.status];
  const notified = w.status === "NOTIFIED" && w.holdRoom && w.holdStartAt && w.holdUntil;
  return (
    <Card className={notified ? "ring-2 ring-cream" : ""}>
      <div className="flex flex-wrap items-center gap-4 p-4">
        <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-cream text-brand-800"><BellRing className="size-5" /></span>
        <div className="min-w-0 flex-1">
          <Badge tone={st.tone}>{st.label}</Badge>
          <div className="mt-1 font-semibold text-brand-900">{w.room ? w.room.name : "İstənilən otaq"} <span className="font-normal text-brand-900/55">— {w.library.shortName}</span></div>
          <div className="text-sm text-brand-900/65">
            {notified
              ? <>Boşalan vaxt: <b>{w.holdRoom!.name}</b>, {fmtRange(w.holdStartAt!, w.holdEndAt!)} · {fmtTime(w.holdUntil!)}-a qədər saxlanılır</>
              : <>{fmtDay(dayKey(w.startAt))}, {fmtRange(w.startAt, w.endAt)}</>}
          </div>
        </div>
        <div className="flex gap-2">
          {notified && (
            <LinkButton size="sm" href={`/rezerv/${w.library.slug}/otaq/${w.holdRoom!.slug}?gun=${dayKey(w.holdStartAt!)}&bas=${w.holdStartAt!.getTime()}`}>İndi rezerv et</LinkButton>
          )}
          <form action={cancelWaitlistAction}>
            <input type="hidden" name="id" value={w.id} />
            <input type="hidden" name="back" value={back} />
            <SubmitButton size="sm" variant="ghost">Ləğv et</SubmitButton>
          </form>
        </div>
      </div>
    </Card>
  );
}

export { INVITE_STATUS };
