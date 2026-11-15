import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { Search } from "lucide-react";
import { Avatar, Badge, Card, EmptyState, PageHeader, btn, cx } from "@/components/ui";
import { requireStaff } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLE_LABELS, USER_TYPE_LABELS } from "@/lib/labels";
import { getRules } from "@/lib/settings";
import { fmtDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "İstifadəçilər" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; f?: string }> }) {
  await requireStaff();
  const sp = await searchParams;
  const rules = await getRules();
  const q = sp.q?.trim();
  const filter = sp.f ?? "all";
  const where: Prisma.UserWhereInput = {
    ...(q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { groupName: { contains: q, mode: "insensitive" } }] } : {}),
    ...(filter === "blocked" ? { blockedAt: { not: null } } : filter === "strikes" ? { noShowStrikes: { gt: 0 } } : filter === "staff" ? { role: { in: ["STAFF", "ADMIN"] } } : {}),
  };
  const [users, total] = await Promise.all([
    db.user.findMany({ where, orderBy: [{ blockedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }], take: 200 }),
    db.user.count({ where }),
  ]);
  const tabs = [["all", "Hamısı"], ["blocked", "Bloklanmış"], ["strikes", "Xəbərdarlığı olan"], ["staff", "Əməkdaşlar"]];
  return (
    <div>
      <PageHeader title="İstifadəçilər" subtitle={`${total} istifadəçi`} />
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1">
          {tabs.map(([k, l]) => (
            <Link key={k} href={`/admin/istifadeciler?f=${k}${q ? `&q=${encodeURIComponent(q)}` : ""}`} className={cx("rounded-xl px-3 py-1.5 text-sm font-medium", filter === k ? "bg-brand-500 text-white" : "bg-white text-brand-800 ring-1 ring-brand-100 hover:bg-brand-50")}>{l}</Link>
          ))}
        </div>
        <form className="flex gap-2">
          <input type="hidden" name="f" value={filter} />
          <input name="q" defaultValue={q} placeholder="Ad, e-poçt və ya qrup" className="field-input w-64 text-sm" />
          <button className={btn("secondary")} aria-label="Axtar"><Search className="size-4" /></button>
        </form>
      </div>
      {users.length === 0 ? <EmptyState title="İstifadəçi tapılmadı" /> : (
        <Card className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-brand-100 bg-brand-50/60 text-left text-xs font-semibold text-brand-900/60 uppercase">
              <tr><th className="px-4 py-3">İstifadəçi</th><th className="px-4 py-3">Fakültə / qrup</th><th className="px-4 py-3">Rol</th><th className="px-4 py-3">Xəbərdarlıq</th><th className="px-4 py-3">Vəziyyət</th><th className="px-4 py-3">Son giriş</th></tr>
            </thead>
            <tbody className="divide-y divide-brand-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-brand-50/40">
                  <td className="px-4 py-2.5">
                    <Link href={`/admin/istifadeciler/${u.id}`} className="flex items-center gap-3">
                      <Avatar name={u.name} email={u.email} size={32} />
                      <span className="min-w-0"><span className="block truncate font-medium text-brand-900">{u.name ?? "—"}</span><span className="block truncate text-xs text-brand-900/55">{u.email}</span></span>
                    </Link>
                  </td>
                  <td className="px-4 py-2.5 text-brand-900/75">{u.userType ? <span className="block text-xs text-brand-900/50">{USER_TYPE_LABELS[u.userType]}</span> : null}{u.faculty ?? u.department ?? "—"}{u.groupName ? ` · ${u.groupName}` : ""}{u.course ? ` · ${u.course}-ci kurs` : ""}</td>
                  <td className="px-4 py-2.5"><Badge tone={u.role === "STUDENT" ? "neutral" : "brand"}>{ROLE_LABELS[u.role]}</Badge></td>
                  <td className={cx("px-4 py-2.5 font-semibold", u.noShowStrikes ? "text-danger" : "text-brand-900/50")}>{u.noShowStrikes}/{rules.noShowLimit}</td>
                  <td className="px-4 py-2.5">{u.blockedAt ? <Badge tone="danger">Bloklanıb</Badge> : u.profileCompletedAt ? <Badge tone="success">Aktiv</Badge> : <Badge tone="warning">Profil natamam</Badge>}</td>
                  <td className="px-4 py-2.5 text-xs text-brand-900/55">{u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
