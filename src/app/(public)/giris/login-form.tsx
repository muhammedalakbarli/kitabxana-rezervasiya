"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { ArrowLeft, KeyRound, Mail } from "lucide-react";
import { loginAction, type LoginState } from "@/app/actions/auth";
import { SubmitButton } from "@/components/submit-button";
import { Alert, Field } from "@/components/ui";

export function LoginForm({ next, domain, devMailbox }: { next: string; domain: string; devMailbox: boolean }) {
  const [state, action] = useActionState<LoginState, FormData>(loginAction, { step: "email" });
  const codeRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (state.step === "code") codeRef.current?.focus();
  }, [state.step]);

  return (
    <form action={action} className="space-y-5" noValidate>
      <input type="hidden" name="next" value={next} />
      {state.error && <Alert tone="danger">{state.error}</Alert>}

      {state.step === "email" ? (
        <>
          <Field label="Universitet e-poçtu" htmlFor="email" hint={`Yalnız @${domain} ünvanları ilə daxil olmaq mümkündür.`}>
            <div className="relative">
              <Mail className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-brand-300" />
              <input
                id="email" name="email" type="email" inputMode="email" autoComplete="email" required autoFocus
                defaultValue={state.email} placeholder={`ad.soyad@${domain}`} className="field-input pl-10"
              />
            </div>
          </Field>
          <SubmitButton name="intent" value="send" className="w-full" size="lg" pendingText="Göndərilir…">Giriş kodu göndər</SubmitButton>
        </>
      ) : (
        <>
          <input type="hidden" name="email" value={state.email} />
          {state.info && (
            <Alert tone="success">
              {state.info}{" "}
              {devMailbox && <Link href="/dev/poct" target="_blank" className="font-semibold underline">Poçt qutusunu aç</Link>}
            </Alert>
          )}
          <Field label="6 rəqəmli kod" htmlFor="code" hint={<>Kod <b>{state.email}</b> ünvanına göndərilib.</>}>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-brand-300" />
              <input
                ref={codeRef} id="code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="\d{6}" required
                placeholder="••••••" className="field-input pl-10 text-center text-xl font-semibold tracking-[0.5em]"
              />
            </div>
          </Field>
          <SubmitButton name="intent" value="verify" className="w-full" size="lg" pendingText="Yoxlanılır…">Daxil ol</SubmitButton>
          <div className="flex items-center justify-between text-sm">
            <button name="intent" value="change" className="inline-flex items-center gap-1 font-medium text-brand-700 hover:underline">
              <ArrowLeft className="size-4" /> E-poçtu dəyiş
            </button>
            <button name="intent" value="resend" className="font-medium text-brand-700 hover:underline">Kodu yenidən göndər</button>
          </div>
        </>
      )}
    </form>
  );
}
