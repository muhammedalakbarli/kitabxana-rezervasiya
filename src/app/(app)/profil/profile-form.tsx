"use client";

import { useActionState, useState } from "react";
import { saveProfileAction, type ProfileState } from "@/app/actions/profile";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field } from "@/components/ui";

type Initial = {
  name: string; userType: string; faculty: string; specialty: string; groupName: string; course: string;
  studentNumber: string; department: string; phone: string; email: string;
};

export function ProfileForm({ initial, first, next }: { initial: Initial; first: boolean; next: string }) {
  const [state, action] = useActionState<ProfileState, FormData>(saveProfileAction, {});
  const [type, setType] = useState(initial.userType || "STUDENT");
  const fe = state.fieldErrors ?? {};
  return (
    <form action={action} className="space-y-6" noValidate>
      <input type="hidden" name="next" value={next} />
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.saved && <Alert tone="success">Dəyişikliklər yadda saxlanıldı.</Alert>}

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="E-poçt" htmlFor="email" hint="Universitet hesabı — dəyişdirilə bilməz">
          <input id="email" value={initial.email} disabled className="field-input" />
        </Field>
        <Field label="Ad və soyad" htmlFor="name" required error={fe.name}>
          <input id="name" name="name" defaultValue={initial.name} autoComplete="name" className="field-input" placeholder="Məs. Aysel Məmmədova" />
        </Field>
      </div>

      <fieldset>
        <legend className="mb-2 text-sm font-medium text-brand-900">Status <span className="text-danger">*</span></legend>
        <div className="grid grid-cols-3 gap-2">
          {[["STUDENT", "Tələbə"], ["ACADEMIC", "Akademik heyət"], ["EMPLOYEE", "Əməkdaş"]].map(([v, l]) => (
            <label key={v} className={`cursor-pointer rounded-xl border px-3 py-2.5 text-center text-sm font-medium transition ${type === v ? "border-brand-500 bg-brand-50 text-brand-800 ring-2 ring-brand-100" : "border-brand-200 bg-white text-brand-900/70 hover:bg-brand-50"}`}>
              <input type="radio" name="userType" value={v} checked={type === v} onChange={() => setType(v)} className="sr-only" />
              {l}
            </label>
          ))}
        </div>
      </fieldset>

      {type === "STUDENT" ? (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Fakültə" htmlFor="faculty" required error={fe.faculty}>
            <input id="faculty" name="faculty" list="faculties" defaultValue={initial.faculty} className="field-input" placeholder="Fakültəni yazın və ya seçin" />
            <datalist id="faculties">
              <option value="Mühəndislik fakültəsi" />
              <option value="İqtisadiyyat fakültəsi" />
            </datalist>
          </Field>
          <Field label="İxtisas" htmlFor="specialty" required error={fe.specialty}>
            <input id="specialty" name="specialty" defaultValue={initial.specialty} className="field-input" placeholder="Məs. Kompüter mühəndisliyi" />
          </Field>
          <Field label="Qrup" htmlFor="groupName" required error={fe.groupName}>
            <input id="groupName" name="groupName" defaultValue={initial.groupName} className="field-input" placeholder="Məs. KOM24C" />
          </Field>
          <Field label="Kurs" htmlFor="course" required error={fe.course}>
            <select id="course" name="course" defaultValue={initial.course} className="field-input">
              <option value="">Seçin</option>
              {[1, 2, 3, 4].map((c) => <option key={c} value={c}>{c}-ci kurs (bakalavr)</option>)}
              <option value="5">Magistratura, 1-ci il</option>
              <option value="6">Magistratura, 2-ci il</option>
            </select>
          </Field>
          <Field label="Tələbə bilet nömrəsi" htmlFor="studentNumber" hint="İstəyə bağlı">
            <input id="studentNumber" name="studentNumber" defaultValue={initial.studentNumber} className="field-input" />
          </Field>
          <Field label="Telefon" htmlFor="phone" hint="İstəyə bağlı — təcili hallarda əlaqə üçün">
            <input id="phone" name="phone" type="tel" defaultValue={initial.phone} autoComplete="tel" className="field-input" placeholder="+994 50 000 00 00" />
          </Field>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          <Field label="Struktur bölmə / kafedra" htmlFor="department" required error={fe.department}>
            <input id="department" name="department" defaultValue={initial.department} className="field-input" placeholder="Məs. Kompüter elmləri kafedrası" />
          </Field>
          <Field label="Telefon" htmlFor="phone" hint="İstəyə bağlı">
            <input id="phone" name="phone" type="tel" defaultValue={initial.phone} autoComplete="tel" className="field-input" />
          </Field>
        </div>
      )}

      <div className="flex justify-end border-t border-brand-100 pt-5">
        <SubmitButton pendingText="Yadda saxlanılır…">{first ? "Davam et" : "Yadda saxla"}</SubmitButton>
      </div>
    </form>
  );
}
