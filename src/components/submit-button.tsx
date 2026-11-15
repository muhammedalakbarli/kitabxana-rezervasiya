"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { btn } from "./ui";

type Variant = Parameters<typeof btn>[0];
type Size = Parameters<typeof btn>[1];

export function SubmitButton({ children, variant = "primary", size = "md", className = "", pendingText, disabled, name, value }: {
  children: ReactNode; variant?: Variant; size?: Size; className?: string; pendingText?: string; disabled?: boolean; name?: string; value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending || disabled} className={btn(variant, size, className)} aria-busy={pending}>
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

/** İki addımlı təsdiq: brauzer dialoqu olmadan "Əminsiniz?" */
export function ConfirmSubmit({ children, confirmText = "Bəli, təsdiqlə", question = "Əminsiniz?", variant = "danger", size = "sm", className = "" }: {
  children: ReactNode; confirmText?: string; question?: string; variant?: Variant; size?: Size; className?: string;
}) {
  const [armed, setArmed] = useState(false);
  const { pending } = useFormStatus();
  if (!armed) {
    return (
      <button type="button" onClick={() => setArmed(true)} className={btn(variant === "danger" ? "outline" : variant, size, className)}>
        {children}
      </button>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <span className="text-sm font-medium text-brand-900">{question}</span>
      <button type="submit" disabled={pending} className={btn(variant, size)}>
        {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
        {confirmText}
      </button>
      <button type="button" onClick={() => setArmed(false)} className={btn("ghost", size)}>
        İmtina
      </button>
    </span>
  );
}
