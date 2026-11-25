"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { btn, cx } from "./ui";

type Variant = Parameters<typeof btn>[0];
type Size = Parameters<typeof btn>[1];

/** Əlçatan modal pəncərə (native <dialog>: fokus tələsi, Esc ilə bağlanma) */
export function Modal({ open, onClose, title, description, children, size = "md", dismissible = true }: {
  open: boolean; onClose?: () => void; title: ReactNode; description?: ReactNode; children: ReactNode; size?: "sm" | "md" | "lg" | "xl"; dismissible?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  const widths = { sm: "max-w-md", md: "max-w-xl", lg: "max-w-3xl", xl: "max-w-5xl" };
  return (
    <dialog
      ref={ref}
      onCancel={(e) => { if (!dismissible) e.preventDefault(); else onClose?.(); }}
      onClick={(e) => { if (dismissible && e.target === ref.current) onClose?.(); }}
      className={cx("m-auto w-[calc(100%-2rem)] rounded-3xl border border-brand-100 bg-white p-0 text-ink shadow-lift backdrop:bg-brand-900/45 backdrop:backdrop-blur-[2px]", widths[size])}
    >
      {open && (
        <div className="flex max-h-[88dvh] flex-col">
          <div className="flex items-start justify-between gap-4 border-b border-brand-100 px-6 py-4">
            <div>
              <h2 className="text-lg font-semibold text-brand-900">{title}</h2>
              {description && <p className="mt-0.5 text-sm text-brand-900/60">{description}</p>}
            </div>
            {dismissible && (
              <button type="button" onClick={onClose} className="-mr-2 rounded-xl p-2 text-brand-400 hover:bg-brand-50 hover:text-brand-700" aria-label="Bağla">
                <X className="size-5" />
              </button>
            )}
          </div>
          <div className="overflow-y-auto px-6 py-5">{children}</div>
        </div>
      )}
    </dialog>
  );
}

/** Modal daxilindəki formanın uğurdan sonra pəncərəni bağlaya bilməsi üçün */
export const ModalContext = createContext<{ close: () => void } | null>(null);
export const useModal = () => useContext(ModalContext);

/** Düymə + modal — admin paneldə əlavə et/redaktə et/sil əməliyyatları üçün */
export function ModalButton({ label, title, description, children, variant = "primary", size = "md", className = "", modalSize = "md" }: {
  label: ReactNode; title: ReactNode; description?: ReactNode; variant?: Variant; size?: Size; className?: string; modalSize?: "sm" | "md" | "lg" | "xl";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <ModalContext.Provider value={{ close }}>
      <button type="button" onClick={() => setOpen(true)} className={btn(variant, size, className)}>{label}</button>
      <Modal open={open} onClose={close} title={title} description={description} size={modalSize}>
        {children}
      </Modal>
    </ModalContext.Provider>
  );
}
