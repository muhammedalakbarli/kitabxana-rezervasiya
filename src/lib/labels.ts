import type { EquipmentReservationStatus, InviteStatus, RequestStatus, ReservationStatus, Role, UserType, WaitlistStatus } from "@prisma/client";
import type { Tone } from "@/components/ui";

export const RESERVATION_STATUS: Record<ReservationStatus, { label: string; tone: Tone }> = {
  BOOKED: { label: "Rezerv olunub", tone: "info" },
  ACTIVE: { label: "İstifadədə", tone: "success" },
  COMPLETED: { label: "Başa çatıb", tone: "neutral" },
  CANCELLED: { label: "Ləğv edilib", tone: "neutral" },
  NO_SHOW: { label: "Gəlmədi", tone: "danger" },
};

export const EQUIPMENT_STATUS: Record<EquipmentReservationStatus, { label: string; tone: Tone }> = {
  BOOKED: { label: "Rezerv olunub", tone: "info" },
  ISSUED: { label: "Təhvil verilib", tone: "success" },
  RETURNED: { label: "Qaytarılıb", tone: "neutral" },
  CANCELLED: { label: "Ləğv edilib", tone: "neutral" },
  NO_SHOW: { label: "Götürülmədi", tone: "warning" },
  OVERDUE: { label: "Qaytarılmayıb", tone: "danger" },
};

export const INVITE_STATUS: Record<InviteStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Cavab gözlənilir", tone: "warning" },
  ACCEPTED: { label: "Qəbul edib", tone: "success" },
  DECLINED: { label: "Rədd edib", tone: "neutral" },
};

export const REQUEST_STATUS: Record<RequestStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Baxılır", tone: "warning" },
  APPROVED: { label: "Təsdiqləndi", tone: "success" },
  REJECTED: { label: "Rədd edildi", tone: "danger" },
  CANCELLED: { label: "Geri çəkildi", tone: "neutral" },
};

export const WAITLIST_STATUS: Record<WaitlistStatus, { label: string; tone: Tone }> = {
  WAITING: { label: "Növbədə", tone: "info" },
  NOTIFIED: { label: "Vaxt boşaldı!", tone: "cream" },
  FULFILLED: { label: "Rezerv edildi", tone: "success" },
  EXPIRED: { label: "Vaxtı keçdi", tone: "neutral" },
  CANCELLED: { label: "Ləğv edildi", tone: "neutral" },
};

export const ROLE_LABELS: Record<Role, string> = { STUDENT: "İstifadəçi", STAFF: "Kitabxana əməkdaşı", ADMIN: "Administrator" };
export const USER_TYPE_LABELS: Record<UserType, string> = { STUDENT: "Tələbə", ACADEMIC: "Akademik heyət", EMPLOYEE: "Əməkdaş" };

/** Audit jurnalı əməliyyatlarının oxunaqlı adları */
export const AUDIT_LABELS: Record<string, string> = {
  "user.registered": "Yeni istifadəçi",
  "profile.completed": "Profil tamamlandı",
  "profile.updated": "Profil yeniləndi",
  "auth.microsoft": "Microsoft ilə giriş",
  "reservation.created": "Otaq rezerv edildi",
  "reservation.cancelled": "Rezerv ləğv edildi",
  "reservation.cancelled.staff": "Əməkdaş rezervi ləğv etdi",
  "reservation.checkin": "QR ilə giriş təsdiqi",
  "reservation.checkin.staff": "Əl ilə giriş təsdiqi",
  "reservation.no_show": "Gəlmədi (avtomatik ləğv)",
  "reservation.shortened": "Müddət qısaldıldı",
  "invite.sent": "Dəvət göndərildi",
  "invite.accepted": "Dəvət qəbul edildi",
  "invite.declined": "Dəvət rədd edildi",
  "waitlist.joined": "Növbəyə yazıldı",
  "waitlist.notified": "Növbə: vaxt boşaldı",
  "extension.requested": "Əlavə vaxt müraciəti",
  "extension.approved": "Müraciət təsdiqləndi",
  "extension.rejected": "Müraciət rədd edildi",
  "equipment.reserved": "Avadanlıq rezerv edildi",
  "equipment.reserved.desk": "Masada avadanlıq rezervi",
  "equipment.cancelled": "Avadanlıq rezervi ləğv edildi",
  "equipment.extended": "Avadanlıq müddəti uzadıldı",
  "equipment.issued": "Avadanlıq təhvil verildi",
  "equipment.issued.qr": "Avadanlıq QR ilə təhvil alındı",
  "equipment.returned": "Avadanlıq qaytarıldı",
  "equipment.no_show": "Avadanlıq götürülmədi",
  "user.blocked": "İstifadəçi bloklandı",
  "user.unblocked": "Blok açıldı",
  "user.role": "Rol dəyişdirildi",
  "settings.rules": "Qaydalar yeniləndi",
  "closedday.add": "Qeyri-iş günü əlavə edildi",
  "closedday.remove": "Qeyri-iş günü silindi",
  "library.created": "Kitabxana yaradıldı",
  "library.updated": "Kitabxana yeniləndi",
  "room.created": "Otaq yaradıldı",
  "room.updated": "Otaq yeniləndi",
  "room.photo.added": "Otaq şəkli əlavə edildi",
  "room.photo.deleted": "Otaq şəkli silindi",
  "equipment.created": "Avadanlıq əlavə edildi",
  "equipment.updated": "Avadanlıq yeniləndi",
  "equipment.photo": "Avadanlıq şəkli",
  "qr.rotated": "QR kod yeniləndi",
};
export const auditLabel = (a: string) => AUDIT_LABELS[a] ?? a;
