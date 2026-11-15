"use client";

import { useActionState } from "react";
import { deskReserveAction } from "@/app/actions/admin";
import type { FormState } from "@/app/actions/reservations";
import { SubmitButton } from "./submit-button";
import { Alert } from "./ui";

export function DeskReserveForm({ equipment, defaultStart, maxLaptop, maxAdapter }: {
  equipment: { id: string; label: string; type: "LAPTOP" | "ADAPTER" }[]; defaultStart: string; maxLaptop: number; maxAdapter: number;
}) {
  const [state, action] = useActionState<FormState, FormData>(deskReserveAction, {});
  const max = Math.max(maxLaptop, maxAdapter);
  const durations: number[] = [];
  for (let m = 30; m <= max; m += 30) durations.push(m);
  return (
    <form action={action} className="space-y-3">
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.ok && <Alert tone="success">{state.ok}</Alert>}
      <input name="email" type="email" required placeholder="istifadəçi@qu.edu.az" className="field-input text-sm" aria-label="İstifadəçinin e-poçtu" />
      <select name="equipmentId" required className="field-input text-sm" aria-label="Avadanlıq">
        {equipment.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}
      </select>
      <div className="grid grid-cols-2 gap-2">
        <input name="start" type="time" step={300} defaultValue={defaultStart} required className="field-input text-sm" aria-label="Başlanğıc" />
        <select name="minutes" defaultValue={String(Math.min(180, max))} className="field-input text-sm" aria-label="Müddət">
          {durations.map((m) => <option key={m} value={m}>{m >= 60 ? `${Math.floor(m / 60)} saat${m % 60 ? " 30 dəq" : ""}` : `${m} dəq`}</option>)}
        </select>
      </div>
      <label className="flex items-center gap-2 text-sm text-brand-900"><input type="checkbox" name="issueNow" value="1" defaultChecked className="accent-brand-500" /> Dərhal təhvil ver</label>
      <SubmitButton className="w-full" pendingText="Yaradılır…">Rezerv et</SubmitButton>
      <p className="text-xs text-brand-900/55">Kitabxana əməkdaşına müraciət edən istifadəçi adına (qaydalar 12.2). Limitlər və bloklar eyni qaydada yoxlanılır.</p>
    </form>
  );
}
