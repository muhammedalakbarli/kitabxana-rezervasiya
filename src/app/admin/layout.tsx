import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { AdminNav } from "@/components/admin-nav";
import { BrandMark } from "@/components/logo";
import { UserMenu } from "@/components/user-menu";
import { Badge } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLE_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: { default: "İdarəetmə", template: "%s · İdarəetmə · QU Kitabxana" } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff();
  const pending = await db.extensionRequest.count({ where: { status: "PENDING" } });
  return (
    <div className="min-h-dvh">
      <header className="no-print sticky top-0 z-40 border-b border-brand-100/70 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6">
          <div className="flex items-center gap-4">
            <Link href="/admin"><BrandMark /></Link>
            <Badge tone="cream" className="hidden sm:inline-flex">{ROLE_LABELS[user.role]}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/panel" className="hidden items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-50 sm:inline-flex"><ArrowLeft className="size-4" /> İstifadəçi görünüşü</Link>
            <UserMenu name={user.name} email={user.email} staff />
          </div>
        </div>
      </header>
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[230px_1fr]">
        <aside className="lg:sticky lg:top-22 lg:h-fit"><AdminNav isAdmin={user.role === "ADMIN"} pending={pending} /></aside>
        <main className="min-w-0 pb-16">{children}</main>
      </div>
    </div>
  );
}
