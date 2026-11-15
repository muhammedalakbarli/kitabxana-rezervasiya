import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle } from "lucide-react";

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "light" | "outline";
type Size = "sm" | "md" | "lg";

export function btn(variant: Variant = "primary", size: Size = "md", extra = "") {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-150 disabled:pointer-events-none disabled:opacity-50 active:translate-y-px select-none whitespace-nowrap";
  const sizes: Record<Size, string> = {
    sm: "h-9 px-3.5 text-[13px]",
    md: "h-11 px-5 text-sm",
    lg: "h-13 px-7 text-[15px]",
  };
  const variants: Record<Variant, string> = {
    primary: "bg-brand-500 text-white shadow-sm hover:bg-brand-600 hover:shadow-md",
    secondary: "bg-brand-50 text-brand-800 ring-1 ring-brand-200 ring-inset hover:bg-brand-100",
    ghost: "text-brand-700 hover:bg-brand-50",
    danger: "bg-danger text-white hover:brightness-95",
    light: "bg-white text-brand-800 shadow-sm hover:bg-cream",
    outline: "bg-white text-brand-800 ring-1 ring-brand-200 ring-inset hover:bg-brand-50",
  };
  return cx(base, sizes[size], variants[variant], extra);
}

export function LinkButton({ href, variant, size, className, children, ...rest }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return (
    <Link href={href} className={btn(variant, size, className ?? "")} {...rest}>
      {children}
    </Link>
  );
}

export function Card({ className, children, ...rest }: ComponentProps<"div">) {
  return (
    <div className={cx("card", className)} {...rest}>
      {children}
    </div>
  );
}

export type Tone = "brand" | "neutral" | "success" | "warning" | "danger" | "info" | "cream";

export function Badge({ tone = "neutral", children, className }: { tone?: Tone; children: ReactNode; className?: string }) {
  const tones: Record<Tone, string> = {
    brand: "bg-brand-500 text-white",
    neutral: "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-100",
    success: "bg-mint text-brand-900",
    warning: "bg-cream text-[#6b5d12] ring-1 ring-inset ring-[#e3e49a]",
    danger: "bg-danger-soft text-danger ring-1 ring-inset ring-[#f0cbc5]",
    info: "bg-sky text-brand-900",
    cream: "bg-cream text-brand-900",
  };
  return (
    <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap", tones[tone], className)}>
      {children}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5 text-xs font-semibold tracking-wider text-brand-500 uppercase">{eyebrow}</div>}
        <h1 className="text-2xl font-semibold tracking-tight text-brand-900 sm:text-[28px]">{title}</h1>
        {subtitle && <p className="mt-1.5 max-w-2xl text-[15px] text-brand-900/70">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-[17px] font-semibold text-brand-900">{children}</h2>
      {action}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon?: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-brand-200 bg-white/60 px-6 py-10 text-center">
      {icon && <div className="mb-3 grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-500">{icon}</div>}
      <div className="font-semibold text-brand-900">{title}</div>
      {text && <p className="mt-1 max-w-sm text-sm text-brand-900/60">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Alert({ tone = "info", title, children, className }: { tone?: "info" | "success" | "warning" | "danger"; title?: ReactNode; children?: ReactNode; className?: string }) {
  const map = {
    info: { cls: "bg-sky/60 text-brand-900 ring-[#a9d9e4]", Icon: Info },
    success: { cls: "bg-mint/70 text-brand-900 ring-[#b7d79c]", Icon: CheckCircle2 },
    warning: { cls: "bg-cream text-[#5a4e0e] ring-[#e1e294]", Icon: AlertTriangle },
    danger: { cls: "bg-danger-soft text-danger ring-[#efc6bf]", Icon: XCircle },
  }[tone];
  const { Icon } = map;
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("flex gap-3 rounded-xl px-4 py-3 text-sm ring-1 ring-inset", map.cls, className)}>
      <Icon className="mt-0.5 size-4.5 shrink-0" aria-hidden />
      <div className="min-w-0">
        {title && <div className="font-semibold">{title}</div>}
        {children && <div className={title ? "mt-0.5 opacity-90" : ""}>{children}</div>}
      </div>
    </div>
  );
}

export function Field({ label, hint, error, children, htmlFor, required }: { label: ReactNode; hint?: ReactNode; error?: string | null; children: ReactNode; htmlFor?: string; required?: boolean }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-medium text-brand-900">
        {label}
        {required && <span className="ml-0.5 text-danger">*</span>}
      </label>
      {children}
      {error ? <p className="text-xs font-medium text-danger">{error}</p> : hint ? <p className="text-xs text-brand-900/55">{hint}</p> : null}
    </div>
  );
}

export function Stat({ label, value, hint, icon, tone = "brand" }: { label: string; value: ReactNode; hint?: ReactNode; icon?: ReactNode; tone?: "brand" | "cream" | "mint" | "sky" | "danger" }) {
  const tones = {
    brand: "bg-brand-50 text-brand-600",
    cream: "bg-cream text-[#6b5d12]",
    mint: "bg-mint text-brand-800",
    sky: "bg-sky text-brand-800",
    danger: "bg-danger-soft text-danger",
  };
  return (
    <Card className="flex items-start gap-3.5 p-4">
      {icon && <div className={cx("grid size-10 shrink-0 place-items-center rounded-xl", tones[tone])}>{icon}</div>}
      <div className="min-w-0">
        <div className="text-[13px] text-brand-900/60">{label}</div>
        <div className="mt-0.5 text-2xl font-semibold tracking-tight text-brand-900">{value}</div>
        {hint && <div className="mt-0.5 text-xs text-brand-900/50">{hint}</div>}
      </div>
    </Card>
  );
}

export function KeyValue({ items }: { items: [ReactNode, ReactNode][] }) {
  return (
    <dl className="divide-y divide-brand-100">
      {items.map(([k, v], i) => (
        <div key={i} className="flex items-start justify-between gap-4 py-2.5 text-sm">
          <dt className="text-brand-900/60">{k}</dt>
          <dd className="text-right font-medium text-brand-900">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Avatar({ name, email, size = 36 }: { name?: string | null; email: string; size?: number }) {
  const src = (name || email).trim();
  const initials = src
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]!.toUpperCase())
    .join("");
  return (
    <span
      className="inline-grid shrink-0 place-items-center rounded-full bg-mint font-semibold text-brand-900"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      aria-hidden
    >
      {initials}
    </span>
  );
}
