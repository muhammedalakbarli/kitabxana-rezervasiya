"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { clientIp, requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { go } from "@/lib/flash";
import {
  cancelExtensionRequest, cancelReservation, createRoomReservation, inviteParticipant, performCheckIn,
  removeParticipant, requestExtension, respondToInvite,
} from "@/lib/reservations";
import { cancelWaitlist, joinWaitlist } from "@/lib/waitlist";
import type { PartyCategory } from "@/lib/rules-config";

export type FormState = { error?: string; ok?: string };

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => Number(f.get(k));

export async function createReservationAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const start = num(form, "start");
  const end = num(form, "end");
  if (!Number.isFinite(start) || !Number.isFinite(end) || !start || !end) return { error: "Vaxtı seçin." };
  const res = await createRoomReservation(user, {
    roomId: str(form, "roomId"),
    start: new Date(start),
    end: new Date(end),
    category: num(form, "category") as PartyCategory,
    headcount: form.get("headcount") ? num(form, "headcount") : null,
    invitees: form.getAll("invitees").map(String).filter((s) => s.trim()),
    purpose: str(form, "purpose") || null,
    rulesAccepted: form.get("rulesAccepted") === "1",
  });
  if (!res.ok) return { error: res.error };
  redirect(`/rezervasiyalarim/${res.id}?ok=${encodeURIComponent("Rezervasiya təsdiqləndi! Təqvim dəvəti e-poçtunuza göndərildi.")}`);
}

export async function joinWaitlistAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const start = num(form, "start");
  const end = num(form, "end");
  if (!start || !end) return { error: "Vaxt aralığını seçin." };
  const anyRoom = form.get("scope") === "any";
  const res = await joinWaitlist(user, {
    libraryId: str(form, "libraryId"),
    roomId: anyRoom ? null : str(form, "roomId") || null,
    start: new Date(start),
    end: new Date(end),
  });
  if (!res.ok) return { error: res.error };
  revalidatePath("/panel");
  return { ok: "Növbəyə yazıldınız. Vaxt boşalan kimi bildiriş və e-poçt alacaqsınız." };
}

export async function cancelWaitlistAction(form: FormData) {
  const user = await requireUser();
  const res = await cancelWaitlist(user, str(form, "id"));
  go(str(form, "back") || "/rezervasiyalarim", res.ok ? { ok: "Növbə qeydi ləğv edildi." } : { err: res.error });
}

export async function respondInviteAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "reservationId");
  const accept = form.get("accept") === "1";
  const res = await respondToInvite(user, id, accept);
  go(str(form, "back") || `/rezervasiyalarim/${id}`, res.ok ? { ok: accept ? "Dəvəti qəbul etdiniz. Başlanğıcda QR kodu skan etməyi unutmayın." : "Dəvət rədd edildi." } : { err: res.error });
}

export async function inviteAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "reservationId");
  const res = await inviteParticipant(user, id, str(form, "email"));
  go(`/rezervasiyalarim/${id}`, res.ok ? { ok: "Dəvət göndərildi." } : { err: res.error });
}

export async function removeParticipantAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "reservationId");
  const res = await removeParticipant(user, id, str(form, "participantId"));
  go(`/rezervasiyalarim/${id}`, res.ok ? { ok: "İştirakçı çıxarıldı." } : { err: res.error });
}

export async function cancelReservationAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "reservationId");
  const res = await cancelReservation(user, id);
  go(`/rezervasiyalarim/${id}`, res.ok ? { ok: "Rezervasiya bağlandı, vaxt digər istifadəçilər üçün açıldı." } : { err: res.error });
}

export async function checkInAction(form: FormData) {
  const user = await requireUser();
  const token = str(form, "token");
  const room = await db.room.findUnique({ where: { qrToken: token }, include: { library: true } });
  if (!room) go("/skan", { err: "QR kod tanınmadı." });
  const res = await performCheckIn(user, room, await clientIp());
  if (!res.ok) go(`/c/${token}`, { err: res.error });
  const msg = res.checkedIn >= res.expected ? "Giriş təsdiqləndi. Uğurlu dərslər!" : `Giriş təsdiqləndi (${res.checkedIn}/${res.expected}). Qrup yoldaşlarınız da ${"QR kodu"} skan etməlidir.`;
  go(`/rezervasiyalarim/${res.reservationId}`, { ok: msg });
}

export async function requestExtensionAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const id = str(form, "reservationId");
  const res = await requestExtension(user, id, num(form, "minutes"), str(form, "reason"));
  if (!res.ok) return { error: res.error };
  go(`/rezervasiyalarim/${id}`, { ok: "Müraciətiniz administratora göndərildi. Cavab bildiriş və e-poçt ilə gələcək." });
}

export async function cancelExtensionAction(form: FormData) {
  const user = await requireUser();
  const res = await cancelExtensionRequest(user, str(form, "requestId"));
  go(`/rezervasiyalarim/${str(form, "reservationId")}`, res.ok ? { ok: "Müraciət geri çəkildi." } : { err: res.error });
}

export async function markAllReadAction() {
  const user = await requireUser();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/", "layout");
}

export async function openNotificationAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  const n = await db.notification.findFirst({ where: { id, userId: user.id } });
  if (n && !n.readAt) await db.notification.update({ where: { id }, data: { readAt: new Date() } });
  redirect(n?.link || "/bildirisler");
}
