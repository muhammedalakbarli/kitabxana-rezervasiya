"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Sparkles } from "lucide-react";
import { saveProfileAction, type ProfileState } from "@/app/actions/profile";
import { changePasswordAction, type PasswordState } from "@/app/actions/auth";
import { Modal } from "./modal";
import { SubmitButton } from "./submit-button";
import { Alert, Field } from "./ui";

export type FacultyOption = { id: string; name: string };
export type ProfileInitial = {
  firstName: string; lastName: string; facultyId: string; specialty: string; course: string; groupName: string;
  phone?: string; studentNumber?: string; email: string;
};

export function ProfileFields({ initial, faculties, errors = {}, extended = false }: { initial: ProfileInitial; faculties: FacultyOption[]; errors?: Record<string, string>; extended?: boolean }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field label="Ad" htmlFor="firstName" required error={errors.firstName}>
        <input id="firstName" name="firstName" defaultValue={initial.firstName} autoComplete="given-name" className="field-input" placeholder="Məs. Aysel" />
      </Field>
      <Field label="Soyad" htmlFor="lastName" required error={errors.lastName}>
        <input id="lastName" name="lastName" defaultValue={initial.lastName} autoComplete="family-name" className="field-input" placeholder="Məs. Məmmədova" />
      </Field>
      <div className="sm:col-span-2">
        <Field label="Fakültə" htmlFor="facultyId" required error={errors.facultyId}>
          <select id="facultyId" name="facultyId" defaultValue={initial.facultyId} className="field-input">
            <option value="">Fakültəni seçin</option>
            {faculties.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </Field>
      </div>
      <div className="sm:col-span-2">
        <Field label="İxtisas" htmlFor="specialty" required error={errors.specialty}>
          <input id="specialty" name="specialty" defaultValue={initial.specialty} className="field-input" placeholder="Məs. Kompüter mühəndisliyi" />
        </Field>
      </div>
      <Field label="Kurs" htmlFor="course" required error={errors.course}>
        <select id="course" name="course" defaultValue={initial.course} className="field-input">
          <option value="">Seçin</option>
          {[1, 2, 3, 4].map((c) => <option key={c} value={c}>{c}-ci kurs</option>)}
          <option value="5">Magistratura, 1-ci il</option>
          <option value="6">Magistratura, 2-ci il</option>
        </select>
      </Field>
      <Field label="Qrup nömrəsi" htmlFor="groupName" required error={errors.groupName}>
        <input id="groupName" name="groupName" defaultValue={initial.groupName} className="field-input uppercase" placeholder="Məs. KOM24C" />
      </Field>
      {extended && (
        <>
          <Field label="Tələbə bilet nömrəsi" htmlFor="studentNumber" hint="İstəyə bağlı">
            <input id="studentNumber" name="studentNumber" defaultValue={initial.studentNumber} className="field-input" />
          </Field>
          <Field label="Telefon" htmlFor="phone" hint="İstəyə bağlı">
            <input id="phone" name="phone" type="tel" defaultValue={initial.phone} autoComplete="tel" className="field-input" placeholder="+994 50 000 00 00" />
          </Field>
        </>
      )}
    </div>
  );
}

export function ProfileForm({ initial, faculties }: { initial: ProfileInitial; faculties: FacultyOption[] }) {
  const [state, action] = useActionState<ProfileState, FormData>(saveProfileAction, {});
  return (
    <form action={action} className="space-y-5" noValidate>
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.saved && <Alert tone="success">Dəyişikliklər yadda saxlanıldı.</Alert>}
      <Field label="E-poçt" htmlFor="email" hint="Universitet hesabı — dəyişdirilə bilməz">
        <input id="email" value={initial.email} disabled className="field-input" />
      </Field>
      <ProfileFields initial={initial} faculties={faculties} errors={state.fieldErrors} extended />
      <div className="flex justify-end border-t border-brand-100 pt-5"><SubmitButton pendingText="Yadda saxlanılır…">Yadda saxla</SubmitButton></div>
    </form>
  );
}

function PasswordField({ id, name, label, hint }: { id: string; name: string; label: string; hint?: string }) {
  const [show, setShow] = useState(false);
  return (
    <Field label={label} htmlFor={id} hint={hint}>
      <div className="relative">
        <input id={id} name={name} type={show ? "text" : "password"} autoComplete={name === "current" ? "current-password" : "new-password"} required className="field-input pr-10" />
        <button type="button" onClick={() => setShow((v) => !v)} className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-lg p-1.5 text-brand-400 hover:bg-brand-50" aria-label={show ? "Gizlət" : "Göstər"}>
          {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    </Field>
  );
}

export function ChangePasswordForm({ requireCurrent = true, onDone }: { requireCurrent?: boolean; onDone?: () => void }) {
  const [state, action] = useActionState<PasswordState, FormData>(changePasswordAction, {});
  useEffect(() => { if (state.ok) onDone?.(); }, [state.ok, onDone]);
  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.ok && <Alert tone="success">{state.ok}</Alert>}
      {requireCurrent && <PasswordField id="current" name="current" label="Hazırkı şifrə" />}
      <PasswordField id="password" name="password" label="Yeni şifrə" hint="Ən azı 8 simvol, hərf və rəqəm" />
      <PasswordField id="password2" name="password2" label="Yeni şifrəni təkrarlayın" />
      <SubmitButton pendingText="Yenilənir…">Şifrəni yenilə</SubmitButton>
    </form>
  );
}

/**
 * Daxil olduqdan sonra açılan məcburi pəncərə:
 * 1) admin şifrəni sıfırlayıbsa — yeni şifrə; 2) profil tamamlanmayıbsa — tələbə məlumatları.
 */
export function OnboardingGate({ mode, initial, faculties }: { mode: "password" | "profile"; initial: ProfileInitial; faculties: FacultyOption[] }) {
  const router = useRouter();
  const [state, action] = useActionState<ProfileState, FormData>(saveProfileAction, {});
  useEffect(() => { if (state.saved) router.refresh(); }, [state.saved, router]);
  if (mode === "password") {
    return (
      <Modal open dismissible={false} title="Yeni şifrə təyin edin" description="Şifrəniz administrator tərəfindən sıfırlanıb. Davam etmək üçün özünüzə yeni şifrə təyin edin." size="sm">
        <ChangePasswordForm requireCurrent={false} onDone={() => router.refresh()} />
      </Modal>
    );
  }
  return (
    <Modal open dismissible={false} title="Xoş gəlmisiniz! Məlumatlarınızı tamamlayın" description="Rezervasiya üçün bu məlumatlar bir dəfə tələb olunur. Universitet sistemi ilə inteqrasiyadan sonra avtomatik doldurulacaq." size="md">
      <form action={action} className="space-y-5" noValidate>
        {state.error && <Alert tone="danger">{state.error}</Alert>}
        <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-3.5 py-2.5 text-sm text-brand-900">
          <Sparkles className="size-4 text-brand-500" /> {initial.email}
        </div>
        <ProfileFields initial={initial} faculties={faculties} errors={state.fieldErrors} />
        <SubmitButton size="lg" className="w-full" pendingText="Yadda saxlanılır…">Davam et</SubmitButton>
      </form>
    </Modal>
  );
}
