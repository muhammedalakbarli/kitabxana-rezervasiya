import type { Metadata } from "next";
import { QrScanner } from "@/components/qr-scanner";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getRules } from "@/lib/settings";

export const metadata: Metadata = { title: "QR skan" };

export default async function ScanPage() {
  await requireUser({ next: "/skan" });
  const rules = await getRules();
  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="QR kodu skan edin"
        subtitle={`Rezerv vaxtınız çatdıqda otağın qapısındakı QR kodu skan edin. Təsdiq başlanğıcdan ${rules.checkInBeforeMinutes} dəq əvvəl açılır və ${rules.checkInAfterMinutes} dəq sonra bağlanır.`}
      />
      <QrScanner />
      <p className="mx-auto mt-6 max-w-sm text-center text-xs text-brand-900/55">
        İpucu: telefonun adi kamera tətbiqi ilə də QR kodu oxuda bilərsiniz — açılan keçid sizi birbaşa təsdiq səhifəsinə aparacaq.
      </p>
    </div>
  );
}
