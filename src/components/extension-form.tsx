"use client";

import { useActionState } from "react";
import { requestExtensionAction, type FormState } from "@/app/actions/reservations";
import { SubmitButton } from "./submit-button";
import { Alert } from "./ui";

export function ExtensionRequestForm({ reservationId, maxMinutes }: { reservationId: string; maxMinutes: number }) {
  const [state, action] = useActionState<FormState, FormData>(requestExtensionAction, {});
  const options = [];
  for (let m = 15; m <= maxMinutes; m += 15) options.push(m);
  if (state.ok) return <Alert tone="success">{state.ok}</Alert>;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="reservationId" value={reservationId} />
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-brand-900">Nə qədər əlavə vaxt lazımdır?</span>
        <select name="minutes" defaultValue="30" className="field-input">
          {options.map((m) => <option key={m} value={m}>+{m >= 60 ? `${Math.floor(m / 60)} saat${m % 60 ? ` ${m % 60} dəq` : ""}` : `${m} dəq`}</option>)}
        </select>
      </label>
      <label className="block text-sm">
        <span className="mb-1 block font-medium text-brand-900">Səbəb</span>
        <textarea name="reason" rows={3} required minLength={10} maxLength={1000} placeholder="Məs. Layihə təqdimatına hazırlaşırıq, 30 dəqiqə əlavə vaxt lazımdır." className="field-input resize-y" />
      </label>
      <SubmitButton variant="secondary" pendingText="Göndərilir…">Administratora göndər</SubmitButton>
    </form>
  );
}
