"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, X, XCircle } from "lucide-react";

/** ?ok=... və ya ?err=... parametrlərini bildiriş kimi göstərir və URL-dən təmizləyir */
export function FlashToast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [toast, setToast] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  useEffect(() => {
    const ok = params.get("ok");
    const err = params.get("err");
    if (!ok && !err) return;
    setToast(err ? { kind: "err", text: err } : { kind: "ok", text: ok! });
    const next = new URLSearchParams(params.toString());
    next.delete("ok");
    next.delete("err");
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    const t = setTimeout(() => setToast(null), err ? 9000 : 5000);
    return () => clearTimeout(t);
  }, [params, pathname, router]);

  if (!toast) return null;
  const ok = toast.kind === "ok";
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex justify-center px-4 sm:bottom-6">
      <div
        role={ok ? "status" : "alert"}
        className={`animate-toast pointer-events-auto flex max-w-md items-start gap-3 rounded-2xl px-4 py-3 text-sm shadow-lift ring-1 ${
          ok ? "bg-brand-900 text-white ring-brand-800" : "bg-white text-danger ring-[#efc6bf]"
        }`}
      >
        {ok ? <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-mint" /> : <XCircle className="mt-0.5 size-5 shrink-0" />}
        <span className="leading-relaxed">{toast.text}</span>
        <button onClick={() => setToast(null)} className="-mr-1 ml-1 rounded-lg p-0.5 opacity-70 hover:opacity-100" aria-label="Bağla">
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
