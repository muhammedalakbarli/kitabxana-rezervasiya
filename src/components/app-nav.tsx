"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarPlus, History, LayoutDashboard, Laptop, ListChecks, QrCode, ShieldCheck, UserRound } from "lucide-react";
import { cx } from "./ui";

const items = [
  { href: "/panel", label: "Panel", icon: LayoutDashboard },
  { href: "/rezerv", label: "Otaq", icon: CalendarPlus },
  { href: "/avadanliq", label: "Avadanlıq", icon: Laptop },
  { href: "/rezervasiyalarim", label: "Rezervlərim", icon: ListChecks },
  { href: "/tarixce", label: "Tarixçə", icon: History },
  { href: "/skan", label: "QR skan", icon: QrCode },
];

const isActive = (path: string, href: string) => path === href || path.startsWith(href + "/");

export function DesktopNav({ staff }: { staff: boolean }) {
  const path = usePathname();
  const list = staff ? [...items, { href: "/admin", label: "İdarəetmə", icon: ShieldCheck }] : items;
  return (
    <nav className="hidden items-center gap-0.5 lg:flex" aria-label="Əsas menyu">
      {list.map((it) => (
        <Link
          key={it.href}
          href={it.href}
          className={cx(
            "inline-flex items-center gap-1.5 rounded-xl px-2 py-2 text-[13px] font-medium whitespace-nowrap transition xl:px-2.5 xl:text-sm",
            isActive(path, it.href) ? "bg-brand-500 text-white shadow-sm" : "text-brand-800 hover:bg-brand-50",
          )}
        >
          <it.icon className="size-4" />
          {it.label}
        </Link>
      ))}
    </nav>
  );
}

export function MobileNav() {
  const path = usePathname();
  const mob = [
    { href: "/panel", label: "Panel", icon: LayoutDashboard },
    { href: "/rezerv", label: "Otaq", icon: CalendarPlus },
    { href: "/skan", label: "Skan", icon: QrCode, center: true },
    { href: "/avadanliq", label: "Avadanlıq", icon: Laptop },
    { href: "/profil", label: "Profil", icon: UserRound },
  ];
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-50 border-t border-brand-100 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Mobil menyu">
      <ul className="grid grid-cols-5">
        {mob.map((it) => {
          const active = isActive(path, it.href) || (it.href === "/profil" && (path.startsWith("/tarixce") || path.startsWith("/rezervasiyalarim")));
          if (it.center) {
            return (
              <li key={it.href} className="flex justify-center">
                <Link href={it.href} className="-mt-5 grid size-14 place-items-center rounded-2xl bg-brand-500 text-white shadow-lift ring-4 ring-white" aria-label="QR kodu skan et">
                  <it.icon className="size-6" />
                </Link>
              </li>
            );
          }
          return (
            <li key={it.href}>
              <Link href={it.href} className={cx("flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active ? "text-brand-600" : "text-brand-900/55")}>
                <it.icon className={cx("size-5", active && "stroke-[2.4]")} />
                {it.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
