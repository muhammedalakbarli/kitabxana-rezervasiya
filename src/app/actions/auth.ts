"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession, requestLoginCode, safeNext, verifyLoginCode } from "@/lib/auth";
import { env } from "@/lib/env";

export type LoginState = { step: "email" | "code"; email?: string; error?: string; info?: string };

export async function loginAction(prev: LoginState, form: FormData): Promise<LoginState> {
  const intent = String(form.get("intent") ?? "send");
  const email = String(form.get("email") ?? prev.email ?? "").trim();
  const next = safeNext(String(form.get("next") ?? ""));

  if (intent === "change") return { step: "email", email };

  if (intent === "send" || intent === "resend") {
    const res = await requestLoginCode(email);
    if (!res.ok) return { step: intent === "resend" ? "code" : "email", email, error: res.error };
    return {
      step: "code",
      email: res.email,
      info: env.mailMode === "log" && env.devMailbox
        ? env.devMailboxKey ? "Test rejimi: kodu sistem administratorundan alın." : "Test rejimi: kod /dev/poct səhifəsində görünür."
        : `Kod ${res.email} ünvanına göndərildi.`,
    };
  }

  const res = await verifyLoginCode(email, String(form.get("code") ?? ""));
  if (!res.ok) return { step: "code", email, error: res.error };
  await createSession(res.user.id);
  redirect(res.user.profileCompletedAt ? next : `/profil?ilk=1&next=${encodeURIComponent(next)}`);
}

export async function logoutAction() {
  await destroySession();
  redirect("/");
}
