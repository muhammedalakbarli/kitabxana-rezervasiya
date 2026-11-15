"use client";

import { useEffect } from "react";
import { btn } from "@/components/ui";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return (
    <div className="grid min-h-[60dvh] place-items-center px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold text-brand-900">Gözlənilməz xəta baş verdi</h1>
        <p className="mt-2 text-sm text-brand-900/60">Zəhmət olmasa yenidən cəhd edin. Problem davam edərsə kitabxana əməkdaşına müraciət edin.{error.digest ? ` (Kod: ${error.digest})` : ""}</p>
        <button onClick={reset} className={btn("primary", "md", "mt-6")}>Yenidən cəhd et</button>
      </div>
    </div>
  );
}
