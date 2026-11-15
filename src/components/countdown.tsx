"use client";

import { useEffect, useState } from "react";

/** Hədəf vaxta qədər geri sayım (hər saniyə yenilənir) */
export function Countdown({ target, prefix = "", doneText = "indi", className }: { target: number; prefix?: string; doneText?: string; className?: string }) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (now === null) return <span className={className}>&nbsp;</span>;
  const diff = Math.max(0, Math.round((target - now) / 1000));
  if (diff === 0) return <span className={className}>{doneText}</span>;
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  const text = h > 24 ? `${Math.round(h / 24)} gün` : h > 0 ? `${h} saat ${m} dəq` : `${m}:${String(s).padStart(2, "0")}`;
  return <span className={className} suppressHydrationWarning>{prefix}{text}</span>;
}
