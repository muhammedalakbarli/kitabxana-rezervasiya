import Link from "next/link";
import { Emblem } from "@/components/logo";
import { btn } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="text-center">
        <Emblem className="mx-auto h-16 w-auto text-brand-500" />
        <div className="mt-6 text-6xl font-semibold text-brand-200">404</div>
        <h1 className="mt-2 text-xl font-semibold text-brand-900">Səhifə tapılmadı</h1>
        <p className="mt-1 text-sm text-brand-900/60">Axtardığınız səhifə mövcud deyil və ya köçürülüb.</p>
        <Link href="/" className={btn("primary", "md", "mt-6")}>Ana səhifəyə qayıt</Link>
      </div>
    </div>
  );
}
