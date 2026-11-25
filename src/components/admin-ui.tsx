"use client";

import { useActionState, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3, Building2, CalendarRange, Check, Copy, FileClock, Gauge, Laptop, MessageSquareText, QrCode, Settings2, ShieldCheck, Users, Wrench,
} from "lucide-react";
import type { FormState } from "@/app/actions/admin";
import { setScopeAction } from "@/app/actions/admin";
import { useModal } from "./modal";
import { SubmitButton } from "./submit-button";
import { Alert, cx } from "./ui";

type Action = (prev: FormState, form: FormData) => Promise<FormState>;

/** Server action-u useActionState ilə işlədən forma; modal içindədirsə uğurda bağlanır */
export function StateForm({ action, children, submitLabel = "Yadda saxla", pendingText = "Yadda saxlanılır…", className = "space-y-4", submitVariant = "primary", resetOnOk = false }: {
  action: Action; children: ReactNode; submitLabel?: ReactNode; pendingText?: string; className?: string; submitVariant?: "primary" | "danger" | "secondary"; resetOnOk?: boolean;
}) {
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const modal = useModal();
  const router = useRouter();
  const [key, setKey] = useState(0);
  useEffect(() => {
    if (state.ok && !state.secret) {
      router.refresh();
      if (resetOnOk) setKey((k) => k + 1);
      if (modal) { const t = setTimeout(() => modal.close(), 900); return () => clearTimeout(t); }
    }
  }, [state, modal, router, resetOnOk]);
  return (
    <form key={key} action={formAction} className={className} noValidate>
      {state.error && <Alert tone="danger">{state.error}</Alert>}
      {state.ok && <Alert tone="success">{state.ok}</Alert>}
      {state.secret && <SecretBox value={state.secret} />}
      {children}
      <div className="flex justify-end gap-2 pt-1">
        <SubmitButton variant={submitVariant} pendingText={pendingText}>{submitLabel}</SubmitButton>
      </div>
    </form>
  );
}

export function SecretBox({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-dashed border-brand-300 bg-cream px-4 py-3">
      <code className="text-lg font-bold tracking-wider text-brand-900">{value}</code>
      <button type="button" onClick={() => { navigator.clipboard?.writeText(value); setCopied(true); }} className="inline-flex items-center gap-1 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-brand-800 ring-1 ring-brand-200">
        {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />} {copied ? "Kopyalandı" : "Kopyala"}
      </button>
    </div>
  );
}

export function ScopeSwitcher({ libraries, current }: { libraries: { id: string; name: string }[]; current: string | null }) {
  const path = usePathname();
  return (
    <form action={setScopeAction} className="rounded-2xl bg-white p-3 shadow-card ring-1 ring-brand-100">
      <input type="hidden" name="back" value={path} />
      <label htmlFor="scope" className="mb-1.5 block text-[11px] font-semibold tracking-wider text-brand-500 uppercase">Kitabxana</label>
      <select id="scope" name="libraryId" defaultValue={current ?? "all"} onChange={(e) => e.currentTarget.form?.requestSubmit()} className="field-input py-2 text-sm font-medium">
        <option value="all">Bütün kitabxanalar</option>
        {libraries.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
      </select>
    </form>
  );
}

type NavItem = { href: string; label: string; icon: typeof Gauge; exact?: boolean; badge?: number };

export function AdminNav({ superAdmin, pending }: { superAdmin: boolean; pending: number }) {
  const path = usePathname();
  const groups: { title: string; items: NavItem[] }[] = [
    {
      title: "Əməliyyat",
      items: [
        { href: "/admin", label: "Canlı vəziyyət", icon: Gauge, exact: true },
        { href: "/admin/rezervasiyalar", label: "Rezervasiyalar", icon: CalendarRange },
        { href: "/admin/muracietler", label: "Müraciətlər", icon: MessageSquareText, badge: pending },
        { href: "/admin/avadanliq", label: "Avadanlıq masası", icon: Laptop },
        { href: "/admin/istifadeciler", label: "İstifadəçilər", icon: Users },
        { href: "/admin/hesabatlar", label: "Hesabatlar və analitika", icon: BarChart3 },
        { href: "/admin/qr", label: "QR kodlar", icon: QrCode },
      ],
    },
    ...(superAdmin
      ? [{
          title: "İdarəetmə",
          items: [
            { href: "/admin/idare/kitabxanalar", label: "Fakültə və kitabxanalar", icon: Building2 },
            { href: "/admin/idare/otaqlar", label: "Oxu otaqları", icon: Wrench },
            { href: "/admin/idare/avadanliq", label: "Avadanlıq", icon: Laptop },
            { href: "/admin/idare/adminler", label: "Adminlər", icon: ShieldCheck },
            { href: "/admin/idare/qaydalar", label: "Qaydalar və bayramlar", icon: Settings2 },
            { href: "/admin/jurnal", label: "Jurnal", icon: FileClock },
          ],
        }]
      : []),
  ];
  return (
    <nav aria-label="İdarəetmə menyusu" className="no-print space-y-4">
      {groups.map((g) => (
        <div key={g.title}>
          <div className="mb-1.5 hidden px-3 text-[11px] font-semibold tracking-wider text-brand-900/40 uppercase lg:block">{g.title}</div>
          <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
            {g.items.map((it) => {
              const active = it.exact ? path === it.href : path === it.href || path.startsWith(it.href + "/");
              return (
                <li key={it.href} className="shrink-0">
                  <Link href={it.href} className={cx("flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition", active ? "bg-brand-500 text-white shadow-sm" : "text-brand-800 hover:bg-white")}>
                    <it.icon className="size-4" />
                    <span className="flex-1">{it.label}</span>
                    {!!it.badge && <span className={cx("rounded-full px-1.5 text-xs font-bold", active ? "bg-white/25" : "bg-cream text-brand-900")}>{it.badge}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
