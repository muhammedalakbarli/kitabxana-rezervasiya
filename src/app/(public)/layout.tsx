import Link from "next/link";
import { BrandMark } from "@/components/logo";
import { SiteFooter } from "@/components/site-footer";
import { LinkButton } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";

export default async function PublicLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-brand-100/70 bg-white/85 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" aria-label="Ana səhifə"><BrandMark /></Link>
          <nav className="flex items-center gap-1 sm:gap-2">
            <Link href="/qaydalar" className="hidden rounded-lg px-3 py-2 text-sm font-medium text-brand-800 hover:bg-brand-50 sm:block">Qaydalar</Link>
            {user ? (
              <LinkButton href="/panel" size="sm">Panelə keç</LinkButton>
            ) : (
              <LinkButton href="/giris" size="sm">Daxil ol</LinkButton>
            )}
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}
