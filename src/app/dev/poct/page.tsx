import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { fmtDateTime } from "@/lib/time";

export const metadata: Metadata = { title: "Test poçt qutusu", robots: { index: false } };
export const dynamic = "force-dynamic";

/** YALNIZ inkişaf/test üçün: MAIL_MODE=log və DEV_MAILBOX=true olduqda göndərilən məktubları göstərir. */
export default async function DevMailbox({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  if (!(env.devMailbox && env.mailMode === "log")) notFound();
  const sp = await searchParams;
  const list = await db.emailLog.findMany({ orderBy: { createdAt: "desc" }, take: 40, select: { id: true, to: true, subject: true, createdAt: true, icsMethod: true } });
  const current = sp.id ? await db.emailLog.findUnique({ where: { id: sp.id } }) : list[0] ? await db.emailLog.findUnique({ where: { id: list[0].id } }) : null;
  return (
    <div className="grid min-h-dvh grid-cols-1 bg-white md:grid-cols-[340px_1fr]">
      <aside className="border-r border-brand-100 bg-brand-50/50">
        <div className="border-b border-brand-100 bg-cream px-4 py-3 text-sm font-semibold text-brand-900">Test poçt qutusu <span className="font-normal text-brand-900/60">(MAIL_MODE=log)</span></div>
        <ul className="max-h-[calc(100dvh-48px)] overflow-y-auto">
          {list.map((m) => (
            <li key={m.id}>
              <a href={`/dev/poct?id=${m.id}`} className={`block border-b border-brand-100 px-4 py-3 text-sm hover:bg-white ${current?.id === m.id ? "bg-white" : ""}`}>
                <div className="truncate font-medium text-brand-900">{m.subject}</div>
                <div className="truncate text-xs text-brand-900/55">{m.to} · {fmtDateTime(m.createdAt)}{m.icsMethod ? ` · 📅 ${m.icsMethod}` : ""}</div>
              </a>
            </li>
          ))}
        </ul>
      </aside>
      <main className="min-w-0">
        {current ? (
          <div className="flex h-full flex-col">
            <div className="border-b border-brand-100 px-5 py-3 text-sm"><b>{current.subject}</b><div className="text-brand-900/60">Kimə: {current.to}</div></div>
            <iframe title="Məktub" srcDoc={current.html} sandbox="" className="min-h-[70dvh] w-full flex-1 border-0" />
            {current.ics && <pre className="max-h-60 overflow-auto border-t border-brand-100 bg-brand-50 p-4 text-xs">{current.ics}</pre>}
          </div>
        ) : <p className="p-8 text-brand-900/60">Məktub yoxdur.</p>}
      </main>
    </div>
  );
}
