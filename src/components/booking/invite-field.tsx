"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, Mail, UserX } from "lucide-react";
import { cx } from "../ui";

export type InviteStatus = "empty" | "typing" | "checking" | "found" | "missing" | "invalid" | "self" | "blocked";

/**
 * Dəvət sahəsi: tələbə yalnız TAM e-poçtu yazdıqda göstərilir (ad + fakültə/qrup).
 * Siyahı və ya avtomatik tamamlama yoxdur — yalnız tanıdığınız şəxsi dəvət edə bilərsiniz.
 */
export function InviteField({ index, domain, value, onChange, onStatus, taken }: {
  index: number; domain: string; value: string; onChange: (v: string) => void; onStatus: (s: InviteStatus) => void; taken: string[];
}) {
  const [status, setStatus] = useState<InviteStatus>("empty");
  const [person, setPerson] = useState<{ name: string | null; detail: string } | null>(null);
  const takenKey = taken.join("|");

  useEffect(() => {
    const email = value.trim().toLowerCase();
    setPerson(null);
    if (!email) { setStatus("empty"); return; }
    if (!new RegExp(`^[^\\s@]+@${domain.replace(/\./g, "\\.")}$`).test(email)) { setStatus("typing"); return; }
    if (takenKey.split("|").includes(email)) { setStatus("invalid"); return; }
    setStatus("checking");
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/istifadeci/axtar?email=${encodeURIComponent(email)}`, { signal: ctrl.signal });
        const j = await r.json();
        if (j.found) { setPerson({ name: j.name, detail: j.detail }); setStatus("found"); }
        else setStatus(j.reason === "self" ? "self" : j.reason === "blocked" ? "blocked" : "missing");
      } catch { /* ləğv edildi */ }
    }, 450);
    return () => { clearTimeout(t); ctrl.abort(); };
  }, [value, domain, takenKey]);

  useEffect(() => { onStatus(status); }, [status, onStatus]);

  return (
    <div>
      <div className="relative">
        <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-brand-300" />
        <input
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          placeholder={`${index + 2}-ci nəfərin tam e-poçtu · ad.soyad@${domain}`}
          className={cx("field-input pl-9 text-sm", status === "found" && "border-brand-500 ring-2 ring-brand-100", (status === "missing" || status === "self" || status === "blocked" || status === "invalid") && "border-danger/60")}
          aria-describedby={`invite-${index}-status`}
        />
      </div>
      <div id={`invite-${index}-status`} className="mt-1.5 min-h-5 text-xs" aria-live="polite">
        {status === "checking" && <span className="inline-flex items-center gap-1 text-brand-900/55"><Loader2 className="size-3.5 animate-spin" /> Yoxlanılır…</span>}
        {status === "found" && person && (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-mint/70 px-2 py-1 text-brand-900"><CheckCircle2 className="size-3.5 text-brand-600" /> <b>{person.name}</b>{person.detail && <span className="text-brand-900/65"> · {person.detail}</span>}</span>
        )}
        {status === "missing" && <span className="inline-flex items-center gap-1 text-danger"><UserX className="size-3.5" /> Bu e-poçtla qeydiyyatdan keçmiş tələbə tapılmadı. Dostunuz əvvəlcə sistemə daxil olmalıdır.</span>}
        {status === "self" && <span className="text-danger">Özünüzü dəvət edə bilməzsiniz.</span>}
        {status === "blocked" && <span className="text-danger">Bu istifadəçinin hesabı bloklanıb.</span>}
        {status === "invalid" && <span className="text-danger">Bu e-poçt artıq yazılıb.</span>}
        {status === "typing" && <span className="text-brand-900/45">Tam universitet e-poçtunu yazın — tələbə yalnız dəqiq uyğunluqda görünür.</span>}
      </div>
    </div>
  );
}
