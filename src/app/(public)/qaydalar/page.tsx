import type { Metadata } from "next";
import { BookOpenCheck } from "lucide-react";
import { RULE_SECTIONS } from "@/content/rules";

export const metadata: Metadata = { title: "İstifadə qaydaları" };

export default function RulesPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <div className="mb-10 max-w-3xl">
        <div className="text-xs font-semibold tracking-wider text-brand-500 uppercase">Kitabxanadan istifadə qaydaları</div>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-brand-900 sm:text-4xl">Öyrənmə otaqları və avadanlıqdan istifadə</h1>
        <p className="mt-3 text-[15px] text-brand-900/70">Rezervasiya etməklə aşağıdakı qaydalarla tanış olduğunuzu və onları qəbul etdiyinizi təsdiq edirsiniz.</p>
      </div>
      <div className="grid gap-8 lg:grid-cols-[220px_1fr]">
        <nav className="no-print hidden lg:block" aria-label="Bölmələr">
          <ul className="sticky top-24 space-y-1 text-sm">
            {RULE_SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`} className="block rounded-lg px-3 py-2 text-brand-800 hover:bg-brand-50">
                  <span className="mr-2 font-semibold text-brand-500">{s.number}.</span>{s.title}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="space-y-8">
          {RULE_SECTIONS.map((s) => (
            <section key={s.id} id={s.id} className="card scroll-mt-24 p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <span className="grid size-10 place-items-center rounded-xl bg-brand-500 text-sm font-semibold text-white">{s.number}</span>
                <h2 className="text-xl font-semibold text-brand-900">{s.title}</h2>
              </div>
              {s.intro && <p className="mt-4 text-[15px] leading-relaxed text-brand-900/75">{s.intro}</p>}
              {s.groups.map((g, gi) => (
                <div key={gi} className="mt-5">
                  {g.title && <h3 className="mb-2 font-semibold text-brand-800">{g.title}</h3>}
                  <ul className="space-y-2.5">
                    {g.items.map((it, i) => (
                      <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-brand-900/85">
                        <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand-400" />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
              {s.outro && (
                <p className="mt-6 flex gap-3 rounded-xl bg-cream px-4 py-3 text-sm text-brand-900">
                  <BookOpenCheck className="size-5 shrink-0 text-brand-600" /> {s.outro}
                </p>
              )}
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
