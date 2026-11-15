"use client";

import { useActionState, useMemo, useState } from "react";
import { BellRing } from "lucide-react";
import { joinWaitlistAction, type FormState } from "@/app/actions/reservations";
import { fmtTime } from "@/lib/time";
import { SubmitButton } from "./submit-button";
import { Alert } from "./ui";

/** "Boş olarsa məni məlumatlandır" — istənilən vaxt aralığı üçün növbəyə yazılma */
export function WaitlistForm({ libraryId, roomId, roomName, times, initialStart }: {
  libraryId: string; roomId: string; roomName: string; times: number[]; initialStart?: number;
}) {
  const [state, action] = useActionState<FormState, FormData>(joinWaitlistAction, {});
  const startTimes = times.slice(0, -1);
  const [start, setStart] = useState<number>(initialStart && startTimes.includes(initialStart) ? initialStart : startTimes[0]);
  const endTimes = useMemo(() => times.filter((t) => t > start && t - start <= 4 * 3600_000), [times, start]);
  const [end, setEnd] = useState<number | null>(null);
  const endVal = end && endTimes.includes(end) ? end : endTimes[Math.min(endTimes.length - 1, 3)];

  if (startTimes.length === 0) return null;
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="libraryId" value={libraryId} />
      <input type="hidden" name="roomId" value={roomId} />
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.ok && <Alert tone="success">{state.ok}</Alert>}
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-brand-900">Başlanğıc</span>
          <select name="start" value={start} onChange={(e) => setStart(Number(e.target.value))} className="field-input">
            {startTimes.map((t) => <option key={t} value={t}>{fmtTime(new Date(t))}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-brand-900">Bitmə</span>
          <select name="end" value={endVal} onChange={(e) => setEnd(Number(e.target.value))} className="field-input">
            {endTimes.map((t) => <option key={t} value={t}>{fmtTime(new Date(t))}</option>)}
          </select>
        </label>
      </div>
      <fieldset className="space-y-2 text-sm">
        <label className="flex items-center gap-2"><input type="radio" name="scope" value="room" defaultChecked className="accent-brand-500" /> Yalnız {roomName}</label>
        <label className="flex items-center gap-2"><input type="radio" name="scope" value="any" className="accent-brand-500" /> Bu kitabxanadakı istənilən otaq</label>
      </fieldset>
      <SubmitButton variant="secondary" className="w-full" pendingText="Yazılır…"><BellRing className="size-4" /> Boş olarsa məni məlumatlandır</SubmitButton>
    </form>
  );
}
