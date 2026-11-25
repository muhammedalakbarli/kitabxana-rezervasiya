import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Building2 } from "lucide-react";
import { AdminNav, ScopeSwitcher } from "@/components/admin-ui";
import { BrandMark } from "@/components/logo";
import { UserMenu } from "@/components/user-menu";
import { Badge } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: { default: "İdarəetmə", template: "%s · İdarəetmə · QU Kitabxana" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireStaff();
  const [pending, libraries] = await Promise.all([
    db.extensionRequest.count({ where: { status: "PENDING", ...(ctx.libraryId ? { reservation: { room: { libraryId: ctx.libraryId } } } : {}) } }),
    db.library.findMany({ where: { archivedAt: null }, orderBy: { sortOrder: "asc" }, select: { id: true, name: true } }),
  ]);
  const myLib = ctx.libraryId ? libraries.find((l) => l.id === ctx.libraryId) : null;
  return (
    <div className="min-h-dvh">
      <header className="no-print sticky top-0 z-40 border-b border-brand-100/70 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link href="/admin"><BrandMark /></Link>
            <Badge tone={ctx.superAdmin ? "brand" : "cream"} className="hidden sm:inline-flex">{ROLE_LABELS[ctx.user.role]}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/panel" className="hidden items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 sm:inline-flex"><ArrowLeft className="size-4" /> Tələbə görünüşü</Link>
            <UserMenu name={ctx.user.name} email={ctx.user.email} staff />
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[240px_1fr]">
        <aside className="space-y-4 lg:sticky lg:top-22 lg:h-fit">
          {ctx.superAdmin ? (
            <ScopeSwitcher libraries={libraries} current={ctx.libraryId} />
          ) : (
            <div className="flex items-center gap-2.5 rounded-2xl bg-white p-3 shadow-card ring-1 ring-brand-100">
              <Building2 className="size-5 text-brand-500" />
              <div className="min-w-0"><div className="text-[11px] font-semibold tracking-wider text-brand-500 uppercase">Sizin kitabxana</div><div className="truncate text-sm font-semibold text-brand-900">{myLib?.name}</div></div>
            </div>
          )}
          <AdminNav superAdmin={ctx.superAdmin} pending={pending} />
        </aside>
        <main className="min-w-0 pb-16">{children}</main>
      </div>
    </div>
  );
}
