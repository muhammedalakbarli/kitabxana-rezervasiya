import type { Metadata } from "next";
import Link from "next/link";
import { Badge, Card, PageHeader, cx } from "@/components/ui";
import { requireSuperAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLabel } from "@/lib/labels";
import { fmtDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Jurnal" };

export default async function JournalPage({ searchParams }: { searchParams: Promise<{ bolme?: string }> }) {
  await requireSuperAdmin();
  const tab = (await searchParams).bolme === "poct" ? "mail" : "audit";
  const [audit, mail] = await Promise.all([
    tab === "audit" ? db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { actor: { select: { name: true, email: true } } } }) : [],
    tab === "mail" ? db.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 150, select: { id: true, to: true, subject: true, status: true, attempts: true, error: true, createdAt: true, icsMethod: true } }) : [],
  ]);
  return (
    <div>
      <PageHeader title="Jurnal" subtitle="Bütün əməliyyatların və göndərilən məktubların qeydiyyatı." />
      <div className="mb-4 inline-flex rounded-2xl bg-white p-1 shadow-card ring-1 ring-brand-100">
        {[["audit", "Əməliyyatlar", "/admin/jurnal"], ["mail", "E-poçt və təqvim", "/admin/jurnal?bolme=poct"]].map(([k, l, h]) => (
          <Link key={k} href={h} className={cx("rounded-xl px-4 py-2 text-sm font-semibold", tab === k ? "bg-brand-500 text-white" : "text-brand-800 hover:bg-brand-50")}>{l}</Link>
        ))}
      </div>
      <Card className="overflow-x-auto">
        {tab === "audit" ? (
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-brand-100 bg-brand-50/60 text-left text-xs font-semibold text-brand-900/60 uppercase"><tr><th className="px-4 py-3">Vaxt</th><th className="px-4 py-3">Əməliyyat</th><th className="px-4 py-3">İcraçı</th><th className="px-4 py-3">Obyekt</th></tr></thead>
            <tbody className="divide-y divide-brand-100">
              {audit.map((a) => (
                <tr key={a.id}>
                  <td className="px-4 py-2 text-xs whitespace-nowrap text-brand-900/60">{fmtDateTime(a.createdAt)}</td>
                  <td className="px-4 py-2"><Badge tone="neutral">{auditLabel(a.action)}</Badge></td>
                  <td className="px-4 py-2 text-brand-900/80">{a.actor ? a.actor.name ?? a.actor.email : <span className="text-brand-900/50">Sistem (avtomatik)</span>}</td>
                  <td className="px-4 py-2 font-mono text-xs text-brand-900/50">{a.entity}{a.entityId ? ` · ${a.entityId.slice(-8)}` : ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b border-brand-100 bg-brand-50/60 text-left text-xs font-semibold text-brand-900/60 uppercase"><tr><th className="px-4 py-3">Vaxt</th><th className="px-4 py-3">Alıcı</th><th className="px-4 py-3">Mövzu</th><th className="px-4 py-3">Status</th></tr></thead>
            <tbody className="divide-y divide-brand-100">
              {mail.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-2 text-xs whitespace-nowrap text-brand-900/60">{fmtDateTime(m.createdAt)}</td>
                  <td className="px-4 py-2 text-brand-900/80">{m.to}</td>
                  <td className="px-4 py-2 text-brand-900">{m.subject.startsWith("Giriş kodu") ? "Giriş kodu: ••••••" : m.subject}{m.icsMethod && <Badge tone="info" className="ml-2">Təqvim: {m.icsMethod}</Badge>}</td>
                  <td className="px-4 py-2"><Badge tone={m.status === "SENT" ? "success" : m.status === "FAILED" ? "danger" : m.status === "LOGGED" ? "neutral" : "warning"}>{m.status}</Badge>{m.error && <span className="ml-2 text-xs text-danger" title={m.error}>xəta</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
