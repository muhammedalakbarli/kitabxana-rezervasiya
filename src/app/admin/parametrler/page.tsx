import type { Metadata } from "next";
import { CalendarOff, Trash2 } from "lucide-react";
import { addClosedDayAction, removeClosedDayAction } from "@/app/actions/admin";
import { RulesForm } from "@/components/rules-form";
import { SubmitButton } from "@/components/submit-button";
import { Card, PageHeader, SectionTitle } from "@/components/ui";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { env, microsoftEnabled } from "@/lib/env";
import { getRules } from "@/lib/settings";
import { dayKey, fmtDay } from "@/lib/time";

export const metadata: Metadata = { title: "Qaydalar və parametrlər" };

export default async function SettingsPage() {
  await requireAdmin();
  const [rules, closed, libraries] = await Promise.all([
    getRules(),
    db.closedDay.findMany({ where: { date: { gte: dayKey(new Date()) } }, orderBy: { date: "asc" }, include: { library: true } }),
    db.library.findMany({ orderBy: { sortOrder: "asc" } }),
  ]);
  const integrations: [string, boolean, string][] = [
    ["E-poçt göndərmə (SMTP)", env.mailMode === "smtp", env.mailMode === "smtp" ? `${env.smtp.host}:${env.smtp.port}` : "Test rejimi — məktublar yalnız jurnala yazılır"],
    ["Microsoft 365 ilə giriş (Entra ID)", microsoftEnabled(), microsoftEnabled() ? "Aktiv" : "MS_TENANT_ID / MS_CLIENT_ID / MS_CLIENT_SECRET təyin edilməyib"],
    ["QR təsdiqi üçün şəbəkə məhdudiyyəti", env.checkinCidrs.length > 0, env.checkinCidrs.length ? env.checkinCidrs.join(", ") : "Söndürülüb — istənilən şəbəkədən təsdiq mümkündür"],
  ];
  return (
    <div className="space-y-8">
      <PageHeader title="Qaydalar və parametrlər" subtitle="Dəyişikliklər dərhal bütün kitabxanalara tətbiq olunur. Mövcud rezervasiyaların müddəti dəyişmir." />
      <Card className="p-5 sm:p-6"><RulesForm rules={rules} /></Card>

      <Card className="p-5 sm:p-6">
        <SectionTitle><span className="inline-flex items-center gap-2"><CalendarOff className="size-5 text-brand-500" /> Qeyri-iş günləri (bayramlar)</span></SectionTitle>
        <form action={addClosedDayAction} className="mb-4 grid gap-2 sm:grid-cols-[160px_1fr_1fr_auto]">
          <input type="date" name="date" required className="field-input" aria-label="Tarix" />
          <input name="reason" placeholder="Səbəb (məs. Novruz bayramı)" className="field-input" aria-label="Səbəb" />
          <select name="libraryId" className="field-input" aria-label="Kitabxana"><option value="">Bütün kitabxanalar</option>{libraries.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
          <SubmitButton variant="secondary">Əlavə et</SubmitButton>
        </form>
        {closed.length === 0 ? <p className="text-sm text-brand-900/55">Gələcək qeyri-iş günü əlavə edilməyib.</p> : (
          <ul className="divide-y divide-brand-100">
            {closed.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span><b>{fmtDay(c.date, { year: true })}</b> — {c.reason} <span className="text-brand-900/50">· {c.library?.name ?? "bütün kitabxanalar"}</span></span>
                <form action={removeClosedDayAction}><input type="hidden" name="id" value={c.id} /><button className="rounded-lg p-1.5 text-danger hover:bg-danger-soft" aria-label="Sil"><Trash2 className="size-4" /></button></form>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5 sm:p-6">
        <SectionTitle>İnteqrasiyalar</SectionTitle>
        <ul className="divide-y divide-brand-100">
          {integrations.map(([name, on, detail]) => (
            <li key={name} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm">
              <span className="font-medium text-brand-900">{name}</span>
              <span className="flex items-center gap-2 text-brand-900/65"><span className={`size-2.5 rounded-full ${on ? "bg-brand-500" : "bg-brand-200"}`} />{detail}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-brand-900/55">Bu parametrlər server mühit dəyişənləri (.env) ilə idarə olunur — rəqəmsal şöbə tərəfindən təyin edilir. Ətraflı: README.md → “İnteqrasiya”.</p>
      </Card>
    </div>
  );
}
