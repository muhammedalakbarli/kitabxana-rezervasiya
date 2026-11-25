/**
 * Fon tapşırıqları — sistemin "kənar müdaxilə olmadan" işləməsini təmin edir:
 *  1. QR pəncərəsi bağlanan rezervləri yekunlaşdır (gəlmədi → ləğv + xəbərdarlıq, natamam qrup → qısaltma)
 *  2. Bitmiş rezervləri tamamla
 *  3. Növbə: vaxtı bitən "hold"ları növbətiyə ötür
 *  4. Avadanlıq: götürülməyən rezervləri ləğv et, qaytarılmayanları blokla
 *  5. Göndərilməmiş məktubları təkrar göndər
 *  6. Saxlama müddəti (standart 1 il) bitmiş tarixçəni sil
 *
 * Çağırılma yolları: scripts/worker.ts (hər 30 san), /api/cron (xarici cron),
 * həmçinin səhifə yüklənərkən (throttle ilə) — worker işləməsə belə məntiq düzgün qalır.
 */
import { completeEndedReservations, finalizeDueReservations } from "./reservations";
import { processWaitlist } from "./waitlist";
import { processEquipment } from "./equipment";
import { retryMail } from "./mail";
import { purgeOldData } from "./management";

let lastRun = 0;
let running: Promise<SweepReport> | null = null;
const THROTTLE_MS = 15_000;

export type SweepReport = { finalized: number; completed: number; waitlist: number; equipment: number; mail: number; purged: number; ms: number };

export async function runSweep(force = false): Promise<SweepReport | null> {
  if (running) return running;
  if (!force && Date.now() - lastRun < THROTTLE_MS) return null;
  lastRun = Date.now();
  running = (async () => {
    const t0 = Date.now();
    const step = async (name: string, fn: () => Promise<number>) => {
      try {
        return await fn();
      } catch (e) {
        console.error(`[sweep:${name}]`, e);
        return 0;
      }
    };
    const finalized = await step("finalize", finalizeDueReservations);
    const completed = await step("complete", completeEndedReservations);
    const waitlist = await step("waitlist", processWaitlist);
    const equipment = await step("equipment", processEquipment);
    const mail = await step("mail", retryMail);
    const purged = await step("retention", () => purgeOldData());
    return { finalized, completed, waitlist, equipment, mail, purged, ms: Date.now() - t0 };
  })();
  try {
    return await running;
  } finally {
    running = null;
  }
}
