import { z } from "zod";

/**
 * Admin tərəfindən tənzimlənən qaydalar. Standart dəyərlər tələb sənədinə uyğundur.
 */
export const rulesSchema = z.object({
  // ── Otaqlar ──────────────────────────────────────────────
  /** 1 nəfər üçün maksimum müddət (standart 1 saat; admin 1.5 və ya 2 saata qaldıra bilər) */
  soloMaxMinutes: z.number().int().min(15).max(480),
  duoMaxMinutes: z.number().int().min(15).max(480),
  trioMaxMinutes: z.number().int().min(15).max(480),
  /** 4 və daha çox nəfər */
  groupMaxMinutes: z.number().int().min(15).max(480),
  /** Başlanğıc vaxtları şəbəkəsi (dəqiqə) */
  slotStepMinutes: z.number().int().refine((v) => [5, 10, 15, 30, 60].includes(v), "5, 10, 15, 30 və ya 60"),
  minDurationMinutes: z.number().int().min(5).max(120),
  /** Neçə gün əvvəldən rezerv etmək olar */
  maxAdvanceDays: z.number().int().min(0).max(60),
  /** Bir istifadəçinin gün ərzində ola biləcəyi otaq rezervasiyası sayı (sahib və ya iştirakçı kimi) */
  roomDailyLimit: z.number().int().min(1).max(10),
  /** QR təsdiq pəncərəsi: başlanğıcdan əvvəl / sonra (dəqiqə) */
  checkInBeforeMinutes: z.number().int().min(0).max(30),
  checkInAfterMinutes: z.number().int().min(1).max(30),
  /** Neçə gəlməmədən sonra avtomatik blok */
  noShowLimit: z.number().int().min(1).max(20),
  /** Növbədə olan istifadəçi üçün boşalan vaxtın saxlanma müddəti */
  waitlistHoldMinutes: z.number().int().min(1).max(60),
  /** Admin-ə göndərilən əlavə vaxt müraciətində maksimum dəqiqə */
  extensionRequestMaxMinutes: z.number().int().min(15).max(240),
  /** Tövsiyə: rezervasiyanı ən azı neçə dəqiqə əvvəl etmək (yalnız məlumat) */
  recommendedLeadMinutes: z.number().int().min(0).max(240),

  // ── Avadanlıq ────────────────────────────────────────────
  laptopMaxMinutes: z.number().int().min(15).max(600),
  adapterMaxMinutes: z.number().int().min(15).max(600),
  /** Uzatma ilkin müddətin neçə faizi qədər ola bilər (standart 50% → 3 saat üçün 1 saat 30 dəq) */
  equipmentExtensionPercent: z.number().int().min(0).max(100),
  equipmentDailyLimit: z.number().int().min(1).max(10),
  /** Başlanğıcdan neçə dəqiqə sonra götürülməyən rezerv ləğv olunur */
  equipmentPickupGraceMinutes: z.number().int().min(5).max(120),
  /** Bitmə vaxtından neçə dəqiqə sonra qaytarılmayan avadanlıq → avtomatik blok */
  equipmentReturnGraceMinutes: z.number().int().min(0).max(120),
});

export type Rules = z.infer<typeof rulesSchema>;

export const DEFAULT_RULES: Rules = {
  soloMaxMinutes: 60,
  duoMaxMinutes: 120,
  trioMaxMinutes: 180,
  groupMaxMinutes: 240,
  slotStepMinutes: 15,
  minDurationMinutes: 15,
  maxAdvanceDays: 7,
  roomDailyLimit: 1,
  checkInBeforeMinutes: 5,
  checkInAfterMinutes: 5,
  noShowLimit: 3,
  waitlistHoldMinutes: 10,
  extensionRequestMaxMinutes: 60,
  recommendedLeadMinutes: 30,
  laptopMaxMinutes: 180,
  adapterMaxMinutes: 180,
  equipmentExtensionPercent: 50,
  equipmentDailyLimit: 1,
  equipmentPickupGraceMinutes: 15,
  equipmentReturnGraceMinutes: 10,
};

/** Otaq tutumu (tələb: maksimum 8 nəfər) — otaq səviyyəsində dəyişdirilə bilər */
export const DEFAULT_ROOM_CAPACITY = 8;
/** "4 və daha çox" kateqoriyası üçün QR ilə təsdiqləməli minimal nəfər */
export const GROUP_MIN_MEMBERS = 4;

export type PartyCategory = 1 | 2 | 3 | 4;

export const PARTY_LABELS: Record<PartyCategory, string> = {
  1: "1 nəfər",
  2: "2 nəfər",
  3: "3 nəfər",
  4: "4 və daha çox nəfər",
};
