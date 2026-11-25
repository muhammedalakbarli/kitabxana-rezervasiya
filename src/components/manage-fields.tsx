/** İdarəetmə formalarının sahələri (server komponentləri — StateForm daxilində istifadə olunur) */
import type { Equipment, Faculty, Library, Room } from "@prisma/client";
import { Field } from "./ui";
import { hhmm } from "@/lib/time";

const DAYS = [[1, "B.e."], [2, "Ç.a."], [3, "Çər."], [4, "C.a."], [5, "Cümə"], [6, "Şən."], [7, "Baz."]] as const;

export function FacultyFields({ f }: { f?: Faculty }) {
  return (
    <>
      {f && <input type="hidden" name="id" value={f.id} />}
      <Field label="Fakültənin adı" required><input name="name" defaultValue={f?.name} className="field-input" placeholder="Məs. Mühəndislik fakültəsi" /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Qısa ad"><input name="shortName" defaultValue={f?.shortName ?? ""} className="field-input" placeholder="Məs. MF" /></Field>
        <Field label="Sıra"><input name="sortOrder" type="number" min={0} defaultValue={f?.sortOrder ?? 10} className="field-input" /></Field>
      </div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="isActive" value="1" defaultChecked={f?.isActive ?? true} className="accent-brand-500" /> Aktiv (tələbə profilində seçilə bilər)</label>
      <input type="hidden" name="isActive" value="0" />
    </>
  );
}

export function LibraryFields({ lib, faculties }: { lib?: Library; faculties: Faculty[] }) {
  return (
    <>
      {lib && <input type="hidden" name="id" value={lib.id} />}
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Kitabxananın adı" required><input name="name" defaultValue={lib?.name} className="field-input" placeholder="Məs. Mühəndislik fakültəsi kitabxanası" /></Field>
        <Field label="Qısa ad" required><input name="shortName" defaultValue={lib?.shortName} className="field-input" placeholder="Məs. Mühəndislik" /></Field>
        <Field label="Fakültə"><select name="facultyId" defaultValue={lib?.facultyId ?? ""} className="field-input"><option value="">— Fakültəyə bağlı deyil —</option>{faculties.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></Field>
        <Field label="Bina" required><input name="building" defaultValue={lib?.building} className="field-input" placeholder="Məs. Mühəndislik fakültəsinin binası" /></Field>
        <Field label="Ünvan"><input name="address" defaultValue={lib?.address ?? ""} className="field-input" /></Field>
        <Field label="Sıra"><input name="sortOrder" type="number" min={0} defaultValue={lib?.sortOrder ?? 10} className="field-input" /></Field>
      </div>
      <Field label="Təsvir"><textarea name="description" rows={2} defaultValue={lib?.description ?? ""} className="field-input" /></Field>
      {lib && (
        <label className="flex items-center gap-2 text-sm">
          <select name="isActive" defaultValue={lib.isActive ? "1" : "0"} className="field-input w-auto py-1.5 text-sm"><option value="1">Aktiv — tələbələr görür</option><option value="0">Müvəqqəti bağlı</option></select>
        </label>
      )}
    </>
  );
}

export function HoursFields({ lib }: { lib: Library }) {
  const wd = lib.workDays.split(",").map(Number);
  return (
    <>
      <input type="hidden" name="id" value={lib.id} />
      <fieldset className="rounded-2xl border border-brand-100 p-4">
        <legend className="px-1 text-sm font-semibold text-brand-900">Kitabxananın iş saatları</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Açılış"><input name="open" type="time" defaultValue={hhmm(lib.openMinute)} className="field-input" /></Field>
          <Field label="Bağlanış"><input name="close" type="time" defaultValue={hhmm(lib.closeMinute)} className="field-input" /></Field>
        </div>
        <p className="mt-2 text-xs text-brand-900/55">Noutbuk və adapter rezervasiyası bu saatlar daxilində mümkündür.</p>
      </fieldset>
      <fieldset className="rounded-2xl border border-brand-100 p-4">
        <legend className="px-1 text-sm font-semibold text-brand-900">Otaq rezervasiyası üçün vaxtlar</legend>
        <div className="grid grid-cols-2 gap-3">
          <Field label="İlk rezervasiya (başlanğıc)" hint="Boş = açılış saatı"><input name="bookingStart" type="time" defaultValue={lib.bookingStartMinute != null ? hhmm(lib.bookingStartMinute) : ""} className="field-input" /></Field>
          <Field label="Son rezervasiya (bitmə)" hint="Boş = bağlanış saatı"><input name="bookingEnd" type="time" defaultValue={lib.bookingEndMinute != null ? hhmm(lib.bookingEndMinute) : ""} className="field-input" /></Field>
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1.5 text-sm font-medium text-brand-900">İş günləri</legend>
        <div className="flex flex-wrap gap-2">
          {DAYS.map(([n, l]) => (
            <label key={n} className="flex items-center gap-1.5 rounded-lg bg-brand-50 px-2.5 py-1.5 text-sm"><input type="checkbox" name="workDays" value={n} defaultChecked={wd.includes(n)} className="accent-brand-500" />{l}</label>
          ))}
        </div>
      </fieldset>
    </>
  );
}

export function RoomFields({ room, libraryId }: { room?: Room; libraryId: string }) {
  return (
    <>
      <input type="hidden" name="libraryId" value={libraryId} />
      {room && <input type="hidden" name="id" value={room.id} />}
      <div className="grid gap-3 sm:grid-cols-[1fr_130px_110px]">
        <Field label="Otağın adı" required><input name="name" defaultValue={room?.name} className="field-input" placeholder="Məs. Otaq 4" /></Field>
        <Field label="Qapı kodu"><input name="code" defaultValue={room?.code ?? ""} className="field-input" placeholder="BO206" /></Field>
        <Field label="Tutum"><input name="capacity" type="number" min={1} max={30} defaultValue={room?.capacity ?? 8} className="field-input" /></Field>
      </div>
      <Field label="Təsvir"><textarea name="description" rows={2} defaultValue={room?.description ?? "Fərdi və qrup şəklində öyrənmə, akademik müzakirələr və onlayn dərslər üçün sakit otaq."} className="field-input" /></Field>
      <Field label="Xüsusiyyətlər" hint="Hər sətirdə bir xüsusiyyət"><textarea name="features" rows={3} defaultValue={room?.features ?? "Dəyirmi iş masası\nWi-Fi"} className="field-input" /></Field>
      <Field label="Sıra"><input name="sortOrder" type="number" min={0} defaultValue={room?.sortOrder ?? 10} className="field-input w-28" /></Field>
    </>
  );
}

export function EquipmentFields({ item, libraries, libraryId }: { item?: Equipment; libraries: { id: string; name: string }[]; libraryId: string }) {
  return (
    <>
      {item && <input type="hidden" name="id" value={item.id} />}
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Növ"><select name="type" defaultValue={item?.type ?? "LAPTOP"} className="field-input"><option value="LAPTOP">Noutbuk</option><option value="ADAPTER">Adapter</option></select></Field>
        <Field label="Etiket (ID)" required><input name="assetTag" defaultValue={item?.assetTag} className="field-input uppercase" placeholder="NB-06" /></Field>
        <Field label="Ad" required><input name="name" defaultValue={item?.name} className="field-input" placeholder="Noutbuk 6" /></Field>
      </div>
      <Field label="Kitabxana"><select name="libraryId" defaultValue={item?.libraryId ?? libraryId} className="field-input">{libraries.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></Field>
      <Field label="Təsvir"><input name="description" defaultValue={item?.description ?? ""} className="field-input" /></Field>
      <Field label="Daxili qeyd" hint="Yalnız adminlər görür (seriya nömrəsi və s.)"><input name="notes" defaultValue={item?.notes ?? ""} className="field-input" /></Field>
    </>
  );
}
