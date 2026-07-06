import { type ReactNode, useEffect } from "react";
import { cn } from "../utils/cn";

// ── CARD ─────────────────────────────────────────────────────
export function Card({
  title,
  icon,
  children,
  className,
  actions,
}: {
  title?: string;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}) {
  return (
    <section className={cn("rounded-lg border border-slate-200 bg-white shadow-sm", className)}>
      {title && (
        <header className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
          <h2 className="flex items-center gap-2 text-[14px] font-semibold tracking-wide text-slate-700 uppercase">
            {icon && <span className="text-teal-700">{icon}</span>}
            {title}
          </h2>
          {actions}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

// ── FIELD (label / value pair) ───────────────────────────────
export function Field({
  label,
  children,
  mono,
}: {
  label: string;
  children: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="mb-1 text-[13px] leading-4 text-slate-500">{label}</div>
      <div
        className={cn(
          "text-[15px] leading-5 font-medium text-slate-800",
          mono && "font-mono tabular-nums"
        )}
      >
        {children ?? "—"}
      </div>
    </div>
  );
}

// ── BADGE ────────────────────────────────────────────────────
export function Badge({
  className,
  children,
  dot,
}: {
  className?: string;
  children: ReactNode;
  dot?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12.5px] font-medium whitespace-nowrap",
        className
      )}
    >
      {dot && <span className={cn("h-1.5 w-1.5 rounded-full", dot)} />}
      {children}
    </span>
  );
}

// ── BUTTON ───────────────────────────────────────────────────
type BtnVariant = "primary" | "success" | "danger" | "outline" | "ghost";

const BTN_STYLES: Record<BtnVariant, string> = {
  primary: "bg-teal-700 text-white hover:bg-teal-800 shadow-sm",
  success: "bg-green-600 text-white hover:bg-green-700 shadow-sm",
  danger: "bg-red-600 text-white hover:bg-red-700 shadow-sm",
  outline: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  ghost: "text-slate-600 hover:bg-slate-100",
};

export function Button({
  variant = "outline",
  className,
  children,
  loading,
  ...rest
}: {
  variant?: BtnVariant;
  loading?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-md px-4 text-[13.5px] font-medium transition-colors",
        "disabled:cursor-not-allowed disabled:opacity-50",
        BTN_STYLES[variant],
        className
      )}
    >
      {loading && (
        <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" opacity="0.25" />
          <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {children}
    </button>
  );
}

// ── MODAL SHELL ──────────────────────────────────────────────
export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-[2px]" onClick={onClose} />
      <div
        className={cn(
          "relative w-full rounded-lg bg-white shadow-2xl",
          wide ? "max-w-2xl" : "max-w-md"
        )}
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <h3 className="text-[15px] font-semibold text-slate-800">{title}</h3>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Закрыть"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        <div className="max-h-[70vh] overflow-y-auto px-5 py-4">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-2 rounded-b-lg border-t border-slate-200 bg-slate-50 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}
