"use client";

import { useActionState } from "react";
import { saveEquipmentAction, saveLibraryAction, saveRoomAction } from "@/app/actions/admin";
import type { FormState } from "@/app/actions/reservations";
import { SubmitButton } from "./submit-button";
import { Alert, Field } from "./ui";

const DAYS = [[1, "B.e."], [2, "Ç.a."], [3, "Çər."], [4, "C.a."], [5, "Cümə"], [6, "Şən."], [7, "Baz."]] as const;

export function LibraryForm({ lib }: { lib?: { id: string; name: string; shortName: string; building: string; address: string | null; description: string | null; open: string; close: string; workDays: string; isActive: boolean; sortOrder: number } }) {
  const [state, action] = useActionState<FormState, FormData>(saveLibraryAction, {});
  const wd = (lib?.workDays ?? "1,2,3,4,5").split(",").map(Number);
  return (
    <form action={action} className="space-y-4">
      {lib && <input type="hidden" name="id" value={lib.id} />}
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.ok && <Alert tone="success">{state.ok}</Alert>}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Ad" required><input name="name" defaultValue={lib?.name} required className="field-input" placeholder="Məs. Mühəndislik fakültəsi kitabxanası" /></Field>
        <Field label="Qısa ad" required><input name="shortName" defaultValue={lib?.shortName} required className="field-input" placeholder="Məs. Mühəndislik" /></Field>
        <Field label="Bina" required><input name="building" defaultValue={lib?.building} required className="field-input" /></Field>
        <Field label="Ünvan"><input name="address" defaultValue={lib?.address ?? ""} className="field-input" /></Field>
        <Field label="Açılış"><input name="open" type="time" defaultValue={lib?.open ?? "09:00"} className="field-input" /></Field>
        <Field label="Bağlanış"><input name="close" type="time" defaultValue={lib?.close ?? "18:00"} className="field-input" /></Field>
      </div>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-brand-900">İş günləri</legend>
        <div className="flex flex-wrap gap-2">
          {DAYS.map(([n, l]) => (
            <label key={n} className="flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-sm"><input type="checkbox" name="workDays" value={n} defaultChecked={wd.includes(n)} className="accent-brand-500" />{l}</label>
          ))}
        </div>
      </fieldset>
      <Field label="Təsvir"><textarea name="description" rows={2} defaultValue={lib?.description ?? ""} className="field-input" /></Field>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-4 text-sm">
          <label className="flex items-center gap-2"><input type="checkbox" name="isActive" value="1" defaultChecked={lib?.isActive ?? true} className="accent-brand-500" /> Aktiv</label>
          <label className="flex items-center gap-2">Sıra <input name="sortOrder" type="number" min={0} defaultValue={lib?.sortOrder ?? 10} className="field-input w-20 py-1.5" /></label>
        </div>
        <SubmitButton>{lib ? "Yadda saxla" : "Kitabxana yarat"}</SubmitButton>
      </div>
    </form>
  );
}

export function RoomForm({ libraryId, room }: { libraryId: string; room?: { id: string; name: string; code: string | null; capacity: number; description: string | null; features: string; sortOrder: number; isActive: boolean } }) {
  const [state, action] = useActionState<FormState, FormData>(saveRoomAction, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="libraryId" value={libraryId} />
      {room && <input type="hidden" name="id" value={room.id} />}
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.ok && <Alert tone="success">{state.ok}</Alert>}
      <div className="grid gap-3 sm:grid-cols-[1fr_120px_110px]">
        <Field label="Ad" required><input name="name" defaultValue={room?.name} required className="field-input" placeholder="Otaq 4" /></Field>
        <Field label="Kod"><input name="code" defaultValue={room?.code ?? ""} className="field-input" placeholder="BO206" /></Field>
        <Field label="Tutum"><input name="capacity" type="number" min={1} max={30} defaultValue={room?.capacity ?? 8} className="field-input" /></Field>
      </div>
      <Field label="Təsvir"><textarea name="description" rows={2} defaultValue={room?.description ?? ""} className="field-input" /></Field>
      <Field label="Xüsusiyyətlər" hint="Hər sətirdə bir xüsusiyyət"><textarea name="features" rows={3} defaultValue={room?.features ?? ""} className="field-input" /></Field>
      <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2"><input type="checkbox" name="isActive" value="1" defaultChecked={room?.isActive ?? true} className="accent-brand-500" /> Aktiv</label>
          <label className="flex items-center gap-2">Sıra <input name="sortOrder" type="number" min={0} defaultValue={room?.sortOrder ?? 10} className="field-input w-20 py-1.5" /></label>
        </div>
        <SubmitButton size="sm">{room ? "Yadda saxla" : "Otaq əlavə et"}</SubmitButton>
      </div>
    </form>
  );
}

export function EquipmentForm({ libraries, item, defaultLibraryId }: { libraries: { id: string; name: string }[]; defaultLibraryId: string; item?: { id: string; type: string; assetTag: string; name: string; description: string | null; notes: string | null; libraryId: string; isActive: boolean } }) {
  const [state, action] = useActionState<FormState, FormData>(saveEquipmentAction, {});
  return (
    <form action={action} className="space-y-3">
      {item && <input type="hidden" name="id" value={item.id} />}
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.ok && <Alert tone="success">{state.ok}</Alert>}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Növ"><select name="type" defaultValue={item?.type ?? "LAPTOP"} className="field-input"><option value="LAPTOP">Noutbuk</option><option value="ADAPTER">Adapter</option></select></Field>
        <Field label="Etiket (ID)" required><input name="assetTag" defaultValue={item?.assetTag} required className="field-input uppercase" placeholder="NB-06" /></Field>
        <Field label="Ad" required><input name="name" defaultValue={item?.name} required className="field-input" placeholder="Noutbuk 6" /></Field>
      </div>
      <Field label="Kitabxana"><select name="libraryId" defaultValue={item?.libraryId ?? defaultLibraryId} className="field-input">{libraries.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
      <Field label="Təsvir"><input name="description" defaultValue={item?.description ?? ""} className="field-input" /></Field>
      <Field label="Daxili qeyd" hint="Yalnız əməkdaşlar görür (seriya nömrəsi, vəziyyət və s.)"><input name="notes" defaultValue={item?.notes ?? ""} className="field-input" /></Field>
      <div className="flex items-center justify-between gap-3 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" name="isActive" value="1" defaultChecked={item?.isActive ?? true} className="accent-brand-500" /> Aktiv (söndürülsə — texniki xidmətdə)</label>
        <SubmitButton size="sm">{item ? "Yadda saxla" : "Əlavə et"}</SubmitButton>
      </div>
    </form>
  );
}
