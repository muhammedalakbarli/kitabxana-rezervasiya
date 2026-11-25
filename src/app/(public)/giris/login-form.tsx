"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ArrowLeft, Eye, EyeOff, KeyRound, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { loginAction, type LoginState } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field } from "@/components/ui";

function PasswordInput({ name, id, autoComplete, placeholder, autoFocus }: { name: string; id: string; autoComplete: string; placeholder?: string; autoFocus?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <LockKeyhole className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-brand-300" />
      <input id={id} name={name} type={show ? "text" : "password"} autoComplete={autoComplete} required autoFocus={autoFocus} placeholder={placeholder} className="field-input px-10" />
      <button type="button" onClick={() => setShow((v) => !v)} className="absolute top-1/2 right-2.5 -translate-y-1/2 rounded-lg p-1.5 text-brand-400 hover:bg-brand-50" aria-label={show ? "Şifrəni gizlət" : "Şifrəni göstər"}>
        {show ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </div>
  );
}

export function LoginForm({ next, domain }: { next: string; domain: string }) {
  const [state, action] = useActionState<LoginState, FormData>(loginAction, { step: "email" });
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    formRef.current?.querySelector<HTMLInputElement>("input:not([type=hidden]):not([disabled])")?.focus();
  }, [state.step]);

  const back = (
    <button name="intent" value="change" formNoValidate className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:underline">
      <ArrowLeft className="size-4" /> E-poçtu dəyiş
    </button>
  );
  const emailChip = state.email && (
    <div className="flex items-center gap-2 rounded-xl bg-brand-50 px-3.5 py-2.5 text-sm text-brand-900">
      <Mail className="size-4 text-brand-500" /> <span className="truncate font-medium">{state.email}</span>
    </div>
  );

  return (
    <form ref={formRef} action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      {state.step !== "email" && <input type="hidden" name="email" value={state.email} />}
      {state.proof && <input type="hidden" name="proof" value={state.proof} />}
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.info && <Alert tone="info">{state.info}</Alert>}

      {state.step === "email" && (
        <>
          <Field label="Universitet e-poçtu" htmlFor="email" hint={`Yalnız @${domain} ünvanları ilə daxil olmaq mümkündür.`}>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-brand-300" />
              <input id="email" name="email" type="email" inputMode="email" autoComplete="username" required defaultValue={state.email} placeholder={`ad.soyad@${domain}`} className="field-input pl-10" />
            </div>
          </Field>
          <SubmitButton name="intent" value="email" className="w-full" size="lg" pendingText="Yoxlanılır…">Davam et</SubmitButton>
        </>
      )}

      {state.step === "password" && (
        <>
          {state.firstName && <p className="text-[15px] text-brand-900">Xoş gördük, <b>{state.firstName}</b>!</p>}
          {emailChip}
          {/* Brauzerin şifrə menecerinə istifadəçi adı ötürülür */}
          <input type="email" name="username" autoComplete="username" value={state.email} readOnly hidden />
          <Field label="Şifrə" htmlFor="password">
            <PasswordInput id="password" name="password" autoComplete="current-password" />
          </Field>
          <SubmitButton name="intent" value="password" className="w-full" size="lg" pendingText="Daxil olunur…">Daxil ol</SubmitButton>
          <div className="flex items-center justify-between">
            {back}
            <button name="intent" value="forgot" formNoValidate className="text-sm font-medium text-brand-700 hover:underline">Şifrəni unutmusunuz?</button>
          </div>
        </>
      )}

      {state.step === "verify" && (
        <>
          {emailChip}
          <Field label="E-poçta göndərilən 6 rəqəmli kod" htmlFor="code">
            <div className="relative">
              <KeyRound className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-brand-300" />
              <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required placeholder="••••••" className="field-input pl-10 text-center text-xl font-semibold tracking-[0.5em]" />
            </div>
          </Field>
          <SubmitButton name="intent" value="verify" className="w-full" size="lg" pendingText="Yoxlanılır…">Təsdiqlə</SubmitButton>
          <div className="flex items-center justify-between">
            {back}
            <button name="intent" value="resend-verify" formNoValidate className="text-sm font-medium text-brand-700 hover:underline">Kodu yenidən göndər</button>
          </div>
        </>
      )}

      {state.step === "register" && (
        <>
          <div className="flex gap-3 rounded-2xl bg-mint/60 p-4 text-sm text-brand-900">
            <ShieldCheck className="size-5 shrink-0 text-brand-600" />
            <span>İlk dəfə daxil olursunuz. Hesabınız üçün şifrə təyin edin — növbəti girişlərdə e-poçt və bu şifrə ilə daxil olacaqsınız.</span>
          </div>
          {emailChip}
          <input type="email" name="username" autoComplete="username" value={state.email} readOnly hidden />
          <Field label="Yeni şifrə" htmlFor="password" hint="Ən azı 8 simvol, hərf və rəqəm">
            <PasswordInput id="password" name="password" autoComplete="new-password" />
          </Field>
          <Field label="Şifrəni təkrarlayın" htmlFor="password2">
            <PasswordInput id="password2" name="password2" autoComplete="new-password" />
          </Field>
          <SubmitButton name="intent" value="register" className="w-full" size="lg" pendingText="Hesab yaradılır…">Hesabı yarat və daxil ol</SubmitButton>
          {back}
        </>
      )}

      {state.step === "forgot" && (
        <>
          {emailChip}
          {!state.info && <p className="text-sm text-brand-900/70">Şifrə bərpası üçün davam edin.</p>}
          {!state.info && <SubmitButton name="intent" value="forgot" className="w-full" size="lg">Bərpa kodu göndər</SubmitButton>}
          {back}
        </>
      )}

      {state.step === "reset" && (
        <>
          {emailChip}
          <Field label="Bərpa kodu" htmlFor="code">
            <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required placeholder="••••••" className="field-input text-center text-xl font-semibold tracking-[0.5em]" />
          </Field>
          <input type="email" name="username" autoComplete="username" value={state.email} readOnly hidden />
          <Field label="Yeni şifrə" htmlFor="password" hint="Ən azı 8 simvol, hərf və rəqəm">
            <PasswordInput id="password" name="password" autoComplete="new-password" />
          </Field>
          <SubmitButton name="intent" value="reset" className="w-full" size="lg" pendingText="Yenilənir…">Şifrəni yenilə və daxil ol</SubmitButton>
          {back}
        </>
      )}
    </form>
  );
}
