import type { BlockReason } from "@prisma/client";
import { db } from "./db";
import { notify, notifyStaff } from "./notify";
import { audit } from "./audit";

export const BLOCK_REASON_LABELS: Record<BlockReason, string> = {
  NO_SHOW_LIMIT: "Rezerv edib gəlməmə limiti",
  EQUIPMENT_OVERDUE: "Avadanlıq qaytarılmayıb",
  EQUIPMENT_LATE: "Avadanlıq gecikmə ilə qaytarılıb",
  MANUAL: "Əməkdaş tərəfindən",
};

/** İstifadəçini bloklayır (artıq bloklanıbsa yalnız tarixçəyə qeyd əlavə edir). */
export async function applyBlock(userId: string, reason: BlockReason, note: string | null, actorId: string | null) {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  await db.userBlock.create({ data: { userId, reason, note, createdById: actorId } });
  if (!user.blockedAt) {
    await db.user.update({ where: { id: userId }, data: { blockedAt: new Date(), blockedReason: note ?? BLOCK_REASON_LABELS[reason] } });
    // Gələcək rezervasiyaları ləğv etmirik — sahib bloklandıqda yeni rezerv edə bilmir,
    // mövcud rezervlər QR təsdiqi ilə öz axarında davam edir.
    await notify(userId, {
      type: "user.blocked",
      title: "Hesabınız müvəqqəti bloklandı",
      body: `Səbəb: ${note ?? BLOCK_REASON_LABELS[reason]}. Bloku açmaq üçün kitabxana əməkdaşına müraciət edin.`,
      link: "/panel",
      email: true,
    });
    await notifyStaff({
      type: "user.blocked.staff",
      title: "İstifadəçi avtomatik bloklandı",
      body: `${user.name ?? user.email} — ${note ?? BLOCK_REASON_LABELS[reason]}`,
      link: `/admin/istifadeciler/${userId}`,
    });
  }
  await audit(actorId, "user.blocked", "User", userId, { reason, note });
}

export async function liftBlock(userId: string, actorId: string, note: string | null) {
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { blockedAt: null, blockedReason: null, noShowStrikes: 0 } }),
    db.userBlock.updateMany({ where: { userId, liftedAt: null }, data: { liftedAt: new Date(), liftedById: actorId, liftNote: note } }),
  ]);
  await notify(userId, {
    type: "user.unblocked",
    title: "Hesabınızın bloku açıldı",
    body: "Artıq yenidən rezervasiya edə bilərsiniz. Qaydalara riayət etdiyiniz üçün təşəkkür edirik.",
    link: "/rezerv",
    email: true,
  });
  await audit(actorId, "user.unblocked", "User", userId, { note });
}
