"use client";

import type { ReactNode } from "react";
import { Check, Pencil } from "lucide-react";
import { cx } from "../ui";

/** Addım-addım rezervasiya ekranının bir addımı */
export function Step({ n, title, state, summary, onEdit, children }: {
  n: number; title: string; state: "done" | "current" | "todo"; summary?: ReactNode; onEdit?: () => void; children?: ReactNode;
}) {
  return (
    <section
      aria-current={state === "current" ? "step" : undefined}
      className={cx(
        "rounded-3xl border bg-white transition-all",
        state === "current" ? "border-brand-200 shadow-lift" : "border-brand-100 shadow-card",
        state === "todo" && "opacity-55",
      )}
    >
      <header className="flex items-center gap-3 px-4 py-3.5 sm:px-5">
        <span className={cx(
          "grid size-8 shrink-0 place-items-center rounded-full text-sm font-semibold",
          state === "done" ? "bg-brand-500 text-white" : state === "current" ? "bg-cream text-brand-900 ring-2 ring-brand-500" : "bg-brand-50 text-brand-400",
        )}>
          {state === "done" ? <Check className="size-4" /> : n}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className={cx("text-[15px] font-semibold", state === "todo" ? "text-brand-900/60" : "text-brand-900")}>{title}</h2>
          {state === "done" && summary && <div className="truncate text-sm text-brand-900/65">{summary}</div>}
        </div>
        {state === "done" && onEdit && (
          <button type="button" onClick={onEdit} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-sm font-medium text-brand-600 hover:bg-brand-50">
            <Pencil className="size-3.5" /> Dəyiş
          </button>
        )}
      </header>
      {state === "current" && <div className="border-t border-brand-100 px-4 py-4 sm:px-5 sm:py-5">{children}</div>}
    </section>
  );
}

export function Chip({ active, disabled, onClick, children, plain }: { active?: boolean; disabled?: boolean; onClick?: () => void; children: ReactNode; plain?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "rounded-xl border px-3 py-2 text-sm font-semibold tabular-nums transition disabled:cursor-not-allowed disabled:opacity-40",
        active ? "border-brand-500 bg-brand-500 text-white shadow-sm" : plain ? "border-brand-100 bg-white text-brand-900 hover:border-brand-400" : "border-brand-100 bg-mint/45 text-brand-900 hover:border-brand-400",
      )}
    >
      {children}
    </button>
  );
}
