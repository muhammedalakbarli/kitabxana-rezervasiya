"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, CalendarRange, FileClock, Gauge, Laptop, MessageSquareText, QrCode, Settings2, Users } from "lucide-react";
import { cx } from "./ui";

export function AdminNav({ isAdmin, pending }: { isAdmin: boolean; pending: number }) {
  const path = usePathname();
  const items = [
    { href: "/admin", label: "Ümumi baxış", icon: Gauge, exact: true },
    { href: "/admin/rezervasiyalar", label: "Rezervasiyalar", icon: CalendarRange },
    { href: "/admin/muracietler", label: "Müraciətlər", icon: MessageSquareText, badge: pending },
    { href: "/admin/avadanliq", label: "Avadanlıq masası", icon: Laptop },
    { href: "/admin/istifadeciler", label: "İstifadəçilər", icon: Users },
    { href: "/admin/kitabxanalar", label: "Kitabxanalar", icon: Building2, admin: true },
    { href: "/admin/qr", label: "QR kodlar", icon: QrCode },
    { href: "/admin/parametrler", label: "Qaydalar və parametrlər", icon: Settings2, admin: true },
    { href: "/admin/jurnal", label: "Jurnal", icon: FileClock },
  ].filter((i) => !i.admin || isAdmin);
  return (
    <nav aria-label="İdarəetmə menyusu" className="no-print">
      <ul className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0">
        {items.map((it) => {
          const active = it.exact ? path === it.href : path === it.href || path.startsWith(it.href + "/");
          return (
            <li key={it.href} className="shrink-0">
              <Link
                href={it.href}
                className={cx(
                  "flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium whitespace-nowrap transition",
                  active ? "bg-brand-500 text-white shadow-sm" : "text-brand-800 hover:bg-white",
                )}
              >
                <it.icon className="size-4" />
                <span className="flex-1">{it.label}</span>
                {!!it.badge && <span className={cx("rounded-full px-1.5 text-xs font-bold", active ? "bg-white/25" : "bg-cream text-brand-900")}>{it.badge}</span>}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
