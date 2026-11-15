import Link from "next/link";
import { Logo } from "./logo";
import { BrandPattern } from "./pattern";

export function SiteFooter() {
  return (
    <footer className="relative mt-16 overflow-hidden bg-brand-900 text-white">
      <BrandPattern className="absolute inset-0 h-full w-full text-white" opacity={0.08} />
      <div className="relative mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-[1.2fr_1fr_1fr] sm:px-6">
        <div>
          <Logo className="h-16 w-auto text-white" />
          <p className="mt-4 max-w-xs text-sm text-white/70">
            Qarabağ Universiteti Kitabxanasının fərdi oxu otaqları və avadanlıqlarının onlayn rezervasiya sistemi.
          </p>
        </div>
        <div className="text-sm">
          <div className="mb-3 font-semibold text-cream">Sistem</div>
          <ul className="space-y-2 text-white/75">
            <li><Link className="hover:text-white" href="/rezerv">Otaq rezerv et</Link></li>
            <li><Link className="hover:text-white" href="/rezervasiyalarim">Rezervasiyalarım</Link></li>
            <li><Link className="hover:text-white" href="/qaydalar">İstifadə qaydaları</Link></li>
          </ul>
        </div>
        <div className="text-sm">
          <div className="mb-3 font-semibold text-cream">İş saatları</div>
          <p className="text-white/75">Bazar ertəsi – Cümə<br />09:00 – 18:00</p>
          <p className="mt-3 text-white/50">Giriş yalnız @qu.edu.az e-poçtları ilə</p>
        </div>
      </div>
      <div className="relative border-t border-white/10 py-4 text-center text-xs text-white/50">
        © {new Date().getFullYear()} Qarabağ Universiteti · Kitabxana
      </div>
    </footer>
  );
}
