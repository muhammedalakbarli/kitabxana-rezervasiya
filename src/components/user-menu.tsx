"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, LogOut, ShieldCheck, UserRound } from "lucide-react";
import { logoutAction } from "@/app/actions/auth";
import { Avatar } from "./ui";

export function UserMenu({ name, email, staff }: { name: string | null; email: string; staff: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("mousedown", onDoc); document.removeEventListener("keydown", onKey); };
  }, []);
  return (
    <div className="relative" ref={ref}>
      <button onClick={() => setOpen((v) => !v)} className="flex items-center gap-2 rounded-xl p-1 pr-2 hover:bg-brand-50" aria-expanded={open} aria-haspopup="menu">
        <Avatar name={name} email={email} size={34} />
        <span className="hidden max-w-[140px] truncate text-sm font-medium text-brand-900 lg:block">{name ?? email}</span>
        <ChevronDown className="hidden size-4 text-brand-400 lg:block" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-brand-100 bg-white shadow-lift">
          <div className="border-b border-brand-100 px-4 py-3">
            <div className="truncate text-sm font-semibold text-brand-900">{name ?? "—"}</div>
            <div className="truncate text-xs text-brand-900/60">{email}</div>
          </div>
          <Link role="menuitem" href="/profil" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-brand-900 hover:bg-brand-50">
            <UserRound className="size-4 text-brand-500" /> Profilim
          </Link>
          {staff && (
            <Link role="menuitem" href="/admin" onClick={() => setOpen(false)} className="flex items-center gap-2.5 px-4 py-2.5 text-sm text-brand-900 hover:bg-brand-50">
              <ShieldCheck className="size-4 text-brand-500" /> İdarəetmə paneli
            </Link>
          )}
          <form action={logoutAction}>
            <button role="menuitem" className="flex w-full items-center gap-2.5 border-t border-brand-100 px-4 py-2.5 text-left text-sm text-danger hover:bg-danger-soft">
              <LogOut className="size-4" /> Çıxış
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
