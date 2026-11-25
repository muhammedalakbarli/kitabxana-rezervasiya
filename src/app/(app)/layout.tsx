import Link from "next/link";
import { Bell } from "lucide-react";
import { BrandMark, Emblem } from "@/components/logo";
import { DesktopNav, MobileNav } from "@/components/app-nav";
import { UserMenu } from "@/components/user-menu";
import { OnboardingGate } from "@/components/profile-forms";
import { getCurrentUser, isStaff } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  const unread = user ? await db.notification.count({ where: { userId: user.id, readAt: null } }) : 0;
  const gate = user ? (user.mustChangePassword ? "password" : !user.profileCompletedAt ? "profile" : null) : null;
  const faculties = gate === "profile" ? await db.faculty.findMany({ where: { isActive: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } }) : [];
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="no-print sticky top-0 z-40 border-b border-brand-100/70 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link href={user ? "/panel" : "/"} aria-label="Ana səhifə" className="shrink-0">
            <span className="hidden sm:inline"><BrandMark /></span>
            <Emblem className="h-9 w-auto text-brand-500 sm:hidden" />
          </Link>
          {user && <DesktopNav staff={isStaff(user)} />}
          <div className="flex items-center gap-1">
            {user ? (
              <>
                <Link href="/bildirisler" className="relative grid size-10 place-items-center rounded-xl text-brand-700 hover:bg-brand-50" aria-label={`Bildirişlər${unread ? ` (${unread} oxunmamış)` : ""}`}>
                  <Bell className="size-5" />
                  {unread > 0 && (
                    <span className="absolute top-1.5 right-1.5 grid min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[10px] leading-[18px] font-bold text-white">
                      {unread > 99 ? "99+" : unread}
                    </span>
                  )}
                </Link>
                <UserMenu name={user.name} email={user.email} staff={isStaff(user)} />
              </>
            ) : (
              <Link href="/giris" className="text-sm font-semibold text-brand-600">Daxil ol</Link>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 pt-6 pb-28 sm:px-6 lg:pb-12">{children}</main>
      {user && <MobileNav />}
      {user && gate && (
        <OnboardingGate
          mode={gate}
          faculties={faculties}
          initial={{
            firstName: user.firstName ?? "", lastName: user.lastName ?? "", facultyId: user.facultyId ?? "", specialty: user.specialty ?? "",
            course: user.course ? String(user.course) : "", groupName: user.groupName ?? "", email: user.email,
          }}
        />
      )}
    </div>
  );
}
