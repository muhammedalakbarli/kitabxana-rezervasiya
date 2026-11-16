import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CalendarClock, QrCode, Users } from "lucide-react";
import { LoginForm } from "./login-form";
import { Emblem } from "@/components/logo";
import { BrandPattern } from "@/components/pattern";
import { Alert, btn } from "@/components/ui";
import { getCurrentUser, safeNext } from "@/lib/auth";
import { env, microsoftEnabled } from "@/lib/env";

export const metadata: Metadata = { title: "Daxil ol" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; xeta?: string }> }) {
  const sp = await searchParams;
  const next = safeNext(sp.next);
  const user = await getCurrentUser();
  if (user) redirect(next);
  const ms = microsoftEnabled();

  return (
    <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:px-6 lg:grid-cols-[1fr_1.05fr] lg:py-16">
      <div className="relative hidden overflow-hidden rounded-3xl bg-brand-500 p-10 text-white lg:block">
        <BrandPattern className="absolute inset-0 h-full w-full text-white" opacity={0.15} />
        <div className="relative">
          <Emblem className="h-16 w-auto text-white" />
          <h2 className="mt-8 text-3xl leading-tight font-semibold">Kitabxana rezervasiya sisteminə xoş gəlmisiniz</h2>
          <ul className="mt-8 space-y-5 text-white/90">
            <li className="flex gap-3"><CalendarClock className="size-5 shrink-0 text-cream" /> Otaqların boş vaxtlarını canlı görün</li>
            <li className="flex gap-3"><Users className="size-5 shrink-0 text-cream" /> Qrup yoldaşlarınızı rezervə dəvət edin</li>
            <li className="flex gap-3"><QrCode className="size-5 shrink-0 text-cream" /> Gəldiyinizi QR kod ilə təsdiqləyin</li>
          </ul>
        </div>
      </div>
      <div className="card p-6 sm:p-10">
        <h1 className="text-2xl font-semibold text-brand-900">Daxil ol</h1>
        <p className="mt-1.5 text-sm text-brand-900/65">Universitet e-poçtunuza birdəfəlik giriş kodu göndəriləcək.</p>
        {sp.xeta && <Alert tone="danger" className="mt-5">{sp.xeta}</Alert>}
        {ms && (
          <>
            <a href={`/auth/microsoft?next=${encodeURIComponent(next)}`} className={btn("outline", "lg", "mt-6 w-full")}>
              <svg viewBox="0 0 21 21" className="size-5" aria-hidden><path fill="#f25022" d="M1 1h9v9H1z" /><path fill="#00a4ef" d="M1 11h9v9H1z" /><path fill="#7fba00" d="M11 1h9v9h-9z" /><path fill="#ffb900" d="M11 11h9v9h-9z" /></svg>
              Microsoft 365 (Outlook) ilə daxil ol
            </a>
            <div className="my-6 flex items-center gap-3 text-xs text-brand-900/45"><span className="h-px flex-1 bg-brand-100" />və ya e-poçt kodu ilə<span className="h-px flex-1 bg-brand-100" /></div>
          </>
        )}
        <div className={ms ? "" : "mt-6"}>
          <LoginForm next={next} domain={env.allowedDomains[0] ?? "qu.edu.az"} devMailbox={env.mailMode === "log" && env.devMailbox && !env.devMailboxKey} />
        </div>
        <p className="mt-6 text-xs leading-relaxed text-brand-900/50">
          Daxil olmaqla Kitabxanadan istifadə qaydaları ilə tanış olduğunuzu təsdiq edirsiniz. Şəxsi məlumatlarınız yalnız rezervasiya məqsədilə istifadə olunur.
        </p>
      </div>
    </div>
  );
}
