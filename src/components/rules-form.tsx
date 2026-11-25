"use client";

import { useActionState } from "react";
import { saveRulesAction } from "@/app/actions/admin";
import type { FormState } from "@/app/actions/admin";
import type { Rules } from "@/lib/rules-config";
import { SubmitButton } from "./submit-button";
import { Alert } from "./ui";

type F = { key: keyof Rules; label: string; hint?: string; unit?: string; options?: number[] };

const groups: { title: string; fields: F[] }[] = [
  {
    title: "Otaq rezervasiyası — müddət limitləri",
    fields: [
      { key: "soloMaxMinutes", label: "1 nəfər", unit: "dəq", options: [60, 90, 120], hint: "Standart 1 saat; xüsusi hallarda 1.5 və ya 2 saat" },
      { key: "duoMaxMinutes", label: "2 nəfər", unit: "dəq" },
      { key: "trioMaxMinutes", label: "3 nəfər", unit: "dəq" },
      { key: "groupMaxMinutes", label: "4 və daha çox nəfər", unit: "dəq" },
    ],
  },
  {
    title: "QR təsdiqi və gəlməmə",
    fields: [
      { key: "checkInBeforeMinutes", label: "Başlanğıcdan əvvəl açılır", unit: "dəq" },
      { key: "checkInAfterMinutes", label: "Başlanğıcdan sonra bağlanır", unit: "dəq", hint: "Bu müddətdə skan edilməsə rezerv ləğv olunur" },
      { key: "noShowLimit", label: "Avtomatik blok üçün gəlməmə sayı", unit: "dəfə" },
      { key: "waitlistHoldMinutes", label: "Növbə: boşalan vaxtın saxlanma müddəti", unit: "dəq" },
    ],
  },
  {
    title: "Rezervasiya şəbəkəsi",
    fields: [
      { key: "slotStepMinutes", label: "Başlanğıc vaxtları addımı", unit: "dəq", options: [5, 10, 15, 30, 60] },
      { key: "minDurationMinutes", label: "Minimum müddət", unit: "dəq" },
      { key: "maxAdvanceDays", label: "Neçə gün əvvəldən", unit: "gün" },
      { key: "roomDailyLimit", label: "Gündəlik otaq rezervasiyası limiti", unit: "ədəd", hint: "Sahib və ya iştirakçı kimi" },
      { key: "extensionRequestMaxMinutes", label: "Əlavə vaxt müraciəti — maksimum", unit: "dəq" },
      { key: "recommendedLeadMinutes", label: "Tövsiyə olunan əvvəlcədən rezerv", unit: "dəq" },
    ],
  },
  {
    title: "Noutbuk və adapterlər",
    fields: [
      { key: "laptopMaxMinutes", label: "Noutbuk — maksimum müddət", unit: "dəq" },
      { key: "adapterMaxMinutes", label: "Adapter — maksimum müddət", unit: "dəq" },
      { key: "equipmentExtensionPercent", label: "Uzatma (ilkin müddətin faizi)", unit: "%", hint: "50% → 3 saat üçün 1 saat 30 dəq" },
      { key: "equipmentDailyLimit", label: "Gündəlik limit (hər növ üçün)", unit: "ədəd" },
      { key: "equipmentPickupGraceMinutes", label: "Götürülmə üçün güzəşt", unit: "dəq" },
      { key: "equipmentReturnGraceMinutes", label: "Qaytarma gecikməsinə güzəşt", unit: "dəq", hint: "Bundan sonra avtomatik blok" },
    ],
  },
  {
    title: "Məlumatların saxlanması",
    fields: [
      { key: "retentionDays", label: "Rezervasiya tarixçəsi və jurnallar saxlanılır", unit: "gün", hint: "Standart 365 gün (1 il). Hesabatlar bu müddət daxilində istənilən aralıq üçün ixrac oluna bilər; köhnə qeydlər avtomatik silinir." },
    ],
  },
];

export function RulesForm({ rules }: { rules: Rules }) {
  const [state, action] = useActionState<FormState, FormData>(saveRulesAction, {});
  return (
    <form action={action} className="space-y-6">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.ok && <Alert tone="success">{state.ok}</Alert>}
      {groups.map((g) => (
        <fieldset key={g.title} className="rounded-2xl border border-brand-100 p-4 sm:p-5">
          <legend className="px-2 text-sm font-semibold text-brand-900">{g.title}</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            {g.fields.map((f) => (
              <label key={f.key} className="block text-sm">
                <span className="mb-1 block font-medium text-brand-900">{f.label}</span>
                <span className="flex items-center gap-2">
                  {f.options ? (
                    <select name={f.key} defaultValue={rules[f.key]} className="field-input">
                      {[...new Set([...f.options, rules[f.key]])].sort((a, b) => a - b).map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input name={f.key} type="number" defaultValue={rules[f.key]} className="field-input" required />
                  )}
                  {f.unit && <span className="w-10 shrink-0 text-xs text-brand-900/55">{f.unit}</span>}
                </span>
                {f.hint && <span className="mt-1 block text-xs text-brand-900/55">{f.hint}</span>}
              </label>
            ))}
          </div>
        </fieldset>
      ))}
      <div className="flex justify-end"><SubmitButton pendingText="Yadda saxlanılır…">Qaydaları yadda saxla</SubmitButton></div>
    </form>
  );
}
