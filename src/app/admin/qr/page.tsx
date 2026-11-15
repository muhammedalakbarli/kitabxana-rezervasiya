import type { Metadata } from "next";
import QRCode from "qrcode";
import { Printer, RefreshCcw } from "lucide-react";
import { rotateQrAction } from "@/app/actions/admin";
import { PrintButton } from "@/components/print-button";
import { Emblem } from "@/components/logo";
import { ConfirmSubmit } from "@/components/submit-button";
import { Card, PageHeader, btn } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { getRules } from "@/lib/settings";

export const metadata: Metadata = { title: "QR kodlar" };

async function qrSvg(token: string) {
  return QRCode.toString(`${env.appUrl}/c/${token}`, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#16423C", light: "#FFFFFF" } });
}

export default async function QrPage({ searchParams }: { searchParams: Promise<{ kitabxana?: string; nov?: string }> }) {
  const user = await requireStaff();
  const sp = await searchParams;
  const rules = await getRules();
  const libraries = await db.library.findMany({
    where: sp.kitabxana ? { id: sp.kitabxana } : { isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { rooms: { where: { isActive: true }, orderBy: { sortOrder: "asc" } }, equipment: { where: { isActive: true }, orderBy: [{ type: "asc" }, { sortOrder: "asc" }] } },
  });
  const showEq = sp.nov === "avadanliq";
  const cards = await Promise.all(
    libraries.flatMap((lib) =>
      (showEq ? lib.equipment.map((e) => ({ kind: "equipment" as const, id: e.id, title: e.assetTag, subtitle: e.name, token: e.qrToken, lib: lib.name }))
        : lib.rooms.map((r) => ({ kind: "room" as const, id: r.id, title: r.name + (r.code ? ` · ${r.code}` : ""), subtitle: "Fərdi oxu otağı", token: r.qrToken, lib: lib.name }))
      ).map(async (c) => ({ ...c, svg: await qrSvg(c.token) })),
    ),
  );
  const allLibs = await db.library.findMany({ orderBy: { sortOrder: "asc" }, select: { id: true, name: true } });

  return (
    <div>
      <div className="no-print">
        <PageHeader
          title="QR kodlar"
          subtitle="Hər otağın qapısına yapışdırılacaq QR kodları çap edin. Kod skan edildikdə tələbə avtomatik təsdiq səhifəsinə yönləndirilir."
          actions={<PrintButton><Printer className="size-4" /> Çap et</PrintButton>}
        />
        <Card className="mb-6 p-4">
          <form className="flex flex-wrap gap-3">
            <select name="kitabxana" defaultValue={sp.kitabxana ?? ""} className="field-input w-auto"><option value="">Bütün kitabxanalar</option>{allLibs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
            <select name="nov" defaultValue={sp.nov ?? ""} className="field-input w-auto"><option value="">Otaqlar</option><option value="avadanliq">Avadanlıq etiketləri</option></select>
            <button className={btn("secondary")}>Göstər</button>
          </form>
        </Card>
      </div>
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3 print:grid-cols-2 print:gap-4">
        {cards.map((c) => (
          <div key={c.id} className="break-inside-avoid overflow-hidden rounded-3xl border-2 border-brand-500 bg-white print:rounded-2xl">
            <div className="flex items-center gap-3 bg-brand-500 px-5 py-3 text-white">
              <Emblem className="h-9 w-auto text-white" />
              <div className="leading-tight"><div className="text-[11px] font-semibold tracking-wider text-cream uppercase">Qarabağ Universiteti</div><div className="text-sm font-medium">{c.lib}</div></div>
            </div>
            <div className="px-6 pt-5 pb-6 text-center">
              <div className="text-2xl font-semibold text-brand-900">{c.title}</div>
              <div className="text-sm text-brand-900/60">{c.subtitle}</div>
              <div className="mx-auto mt-4 w-52 [&>svg]:h-auto [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: c.svg }} />
              <div className="mt-2 text-xs text-brand-900/55">Kamera ilə skan edin və ya kodu daxil edin:</div>
              <div className="mt-1 inline-block rounded-lg bg-cream px-3 py-1 font-mono text-lg font-bold tracking-[0.25em] text-brand-900">{c.token}</div>
              {c.kind === "room" && <p className="mt-3 text-xs leading-relaxed text-brand-900/70">Rezervasiyanın başlanğıcından {rules.checkInAfterMinutes} dəqiqə ərzində skan edin. Qrup üzvlərinin hər biri skan etməlidir.</p>}
              {user.role === "ADMIN" && (
                <form action={rotateQrAction} className="no-print mt-4">
                  <input type="hidden" name="kind" value={c.kind} />
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="back" value={`/admin/qr${sp.kitabxana ? `?kitabxana=${sp.kitabxana}` : ""}${sp.nov ? `${sp.kitabxana ? "&" : "?"}nov=${sp.nov}` : ""}`} />
                  <ConfirmSubmit variant="secondary" question="Köhnə kod işləməyəcək" confirmText="Yenilə"><RefreshCcw className="size-3.5" /> Kodu yenilə</ConfirmSubmit>
                </form>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
