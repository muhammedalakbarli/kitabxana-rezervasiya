/**
 * Fon tapşırıqları prosesi — tətbiqlə yanaşı işə salınır: `npm run worker`
 * Hər 30 saniyədən bir: QR pəncərələrini yekunlaşdırır, gəlməyənləri qeyd edir, növbəni irəlilədir,
 * qaytarılmayan avadanlığı bloklayır, göndərilməmiş məktubları təkrar göndərir.
 */
import { runSweep } from "../src/lib/sweep";
import { db } from "../src/lib/db";

const INTERVAL = Number(process.env.WORKER_INTERVAL_MS ?? 30_000);
let stopping = false;

async function loop() {
  while (!stopping) {
    try {
      const r = await runSweep(true);
      if (r && (r.finalized || r.waitlist || r.equipment || r.mail)) console.log(new Date().toISOString(), "sweep", JSON.stringify(r));
    } catch (e) {
      console.error("sweep failed", e);
    }
    await new Promise((res) => setTimeout(res, INTERVAL));
  }
  await db.$disconnect();
}

for (const sig of ["SIGINT", "SIGTERM"] as const) process.on(sig, () => { stopping = true; console.log("worker dayanır…"); });
console.log(`Kitabxana worker işə düşdü (interval ${INTERVAL / 1000}s)`);
loop();
