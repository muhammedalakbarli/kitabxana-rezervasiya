"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { go } from "@/lib/flash";
import { cancelEquipmentReservation, createEquipmentReservation, extendEquipmentReservation, issueEquipment } from "@/lib/equipment";
import { fmtTime } from "@/lib/time";
import type { FormState } from "./reservations";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function createEquipmentAction(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser();
  const start = Number(form.get("start"));
  const end = Number(form.get("end"));
  if (!start || !end) return { error: "Vaxtı seçin." };
  const res = await createEquipmentReservation(user, {
    equipmentId: str(form, "equipmentId"),
    start: new Date(start),
    end: new Date(end),
    rulesAccepted: form.get("rulesAccepted") === "1",
  });
  if (!res.ok) return { error: res.error };
  redirect(`/rezervasiyalarim/avadanliq/${res.id}?ok=${encodeURIComponent("Avadanlıq rezerv olundu. Təhvil almaq üçün vaxtında kitabxanaya yaxınlaşın.")}`);
}

export async function cancelEquipmentAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  const res = await cancelEquipmentReservation(user, id);
  go(`/rezervasiyalarim/avadanliq/${id}`, res.ok ? { ok: "Rezervasiya ləğv edildi." } : { err: res.error });
}

export async function extendEquipmentAction(form: FormData) {
  const user = await requireUser();
  const id = str(form, "id");
  const res = await extendEquipmentReservation(user, id, Number(form.get("minutes")));
  go(`/rezervasiyalarim/avadanliq/${id}`, res.ok ? { ok: `Müddət ${fmtTime(res.newEnd)}-a qədər uzadıldı.` } : { err: res.error });
}

/** Avadanlığın üzərindəki QR kodu skan edərək təhvil alma */
export async function selfPickupAction(form: FormData) {
  const user = await requireUser();
  const token = str(form, "token");
  const eq = await db.equipment.findUnique({ where: { qrToken: token } });
  if (!eq) go("/skan", { err: "QR kod tanınmadı." });
  const r = await db.equipmentReservation.findFirst({ where: { equipmentId: eq.id, userId: user.id, status: "BOOKED" }, orderBy: { startAt: "asc" } });
  if (!r) go(`/c/${token}`, { err: "Bu avadanlıq üçün təhvil gözləyən rezervasiyanız yoxdur." });
  const res = await issueEquipment(null, r.id, "qr");
  go(res.ok ? `/rezervasiyalarim/avadanliq/${r.id}` : `/c/${token}`, res.ok ? { ok: "Təhvil təsdiqləndi. Vaxtında qaytarmağı unutmayın." } : { err: res.error });
}
