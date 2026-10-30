"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ChevronDown, Loader2, Trash2, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/** Input inside `PayrollModalField`: the label sits inside the field, above the value. */
export const PAYROLL_MODAL_INPUT =
  "h-auto w-full rounded-lg border border-[var(--pr-input)] bg-card px-3 pb-[7px] pt-[21px] text-[13.5px] text-foreground shadow-sm transition-colors placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none focus:ring-2 focus:ring-[var(--pr-brand-100)] disabled:cursor-not-allowed disabled:bg-muted/50 disabled:text-muted-foreground";
export const PAYROLL_MODAL_SELECT = cn(PAYROLL_MODAL_INPUT, "cursor-pointer appearance-none pr-8");
/** Listbox (`<select size={n}>`) for employee pickers. */
export const PAYROLL_MODAL_LIST =
  "w-full rounded-lg border border-[var(--pr-input)] bg-card p-1 text-[13px] text-foreground shadow-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-[var(--pr-brand-100)] [&>option]:rounded-md [&>option]:px-2 [&>option]:py-1 [&>option:checked]:font-medium [&>option:checked]:text-[var(--pr-brand-700)] [&>option:checked]:[background:linear-gradient(var(--pr-brand-100),var(--pr-brand-100))]";
export const PAYROLL_CHECKBOX = "size-4 shrink-0 cursor-pointer rounded border-[var(--pr-input)] accent-primary";

const BTN =
  "inline-flex h-9 select-none items-center justify-center gap-2 rounded-lg px-4 text-[13.5px] font-medium transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60 [&_svg]:size-4";
export const PAYROLL_BTN = {
  primary: cn(BTN, "bg-primary text-white shadow-sm hover:bg-[var(--pr-brand-600)]"),
  secondary: cn(BTN, "border border-[var(--pr-input)] bg-card text-foreground/80 shadow-sm hover:bg-muted"),
  danger: cn(BTN, "bg-rose-600 text-white shadow-sm hover:bg-rose-700"),
  dangerGhost: cn(BTN, "text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10")
};

export function PayrollModal({
  open,
  onClose,
  title,
  width = "sm:max-w-[460px]",
  headerExtra,
  className,
  children
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  width?: string;
  headerExtra?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="bg-[#0b201c]/50 supports-backdrop-filter:backdrop-blur-none"
        className={cn(
          "payroll-template top-[7vh] max-h-[86vh] translate-y-0 gap-0 overflow-y-auto rounded-xl bg-card p-0 text-foreground ring-0",
          "shadow-[0_4px_6px_-2px_rgb(16_42_38/0.06),0_12px_28px_-6px_rgb(16_42_38/0.16)]",
          width,
          className
        )}
      >
        <div className="flex items-center justify-between gap-3 px-5 pb-1 pt-4">
          <DialogTitle className="text-[16px] font-bold leading-snug tracking-[-0.01em]">{title}</DialogTitle>
          {headerExtra ? <div className="ml-auto">{headerExtra}</div> : null}
          <DialogClose
            aria-label="Закрыть"
            className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="size-[18px]" />
          </DialogClose>
        </div>
        <div className="px-5 pb-5 pt-3">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

export function PayrollModalField({
  label,
  error,
  hint,
  select,
  className,
  children
}: {
  label: string;
  error?: string | null;
  hint?: ReactNode;
  select?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={className}>
      <label className="relative block">
        {children}
        <span className={cn("pointer-events-none absolute left-3 top-[7px] text-[10.5px] font-medium", error ? "text-rose-500" : "text-muted-foreground")}>
          {label}
        </span>
        {select ? <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden /> : null}
      </label>
      {error ? <p className="mt-1 text-[12px] text-rose-600">{error}</p> : hint ? <p className="mt-1 text-[12px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Bordered box with a small caption, e.g. a group of checkboxes. */
export function PayrollModalSection({ title, children, className }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-lg border border-[var(--pr-border)] p-3", className)}>
      {title ? <p className="mb-2 text-[12px] font-medium text-muted-foreground">{title}</p> : null}
      {children}
    </div>
  );
}

export function PayrollModalCheck({ label, checked, onChange, disabled }: { label: ReactNode; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-foreground/80">
      <input type="checkbox" className={PAYROLL_CHECKBOX} checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function PayrollModalSwitch({ label, checked, onChange, disabled }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-[var(--pr-border)] bg-[var(--pr-head)] px-3.5 py-2.5">
      <span className="text-[13px] font-medium text-foreground/80">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "relative inline-flex h-[22px] w-10 shrink-0 items-center rounded-full transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "bg-primary" : "bg-gray-300 dark:bg-muted-foreground/40"
        )}
      >
        <span className={cn("inline-block size-4 rounded-full bg-white shadow transition-transform duration-200", checked ? "translate-x-[21px]" : "translate-x-[3px]")} />
      </button>
    </div>
  );
}

export function PayrollModalNote({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "error" | "warn" }) {
  return (
    <div
      className={cn(
        "rounded-lg px-3 py-2 text-[12.5px] leading-relaxed",
        tone === "error" && "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
        tone === "warn" && "bg-amber-50 text-amber-800 dark:bg-amber-500/10 dark:text-amber-300",
        tone === "muted" && "bg-[var(--pr-head)] text-muted-foreground"
      )}
    >
      {children}
    </div>
  );
}

export function PayrollModalActions({
  onCancel,
  onSubmit,
  submitLabel = "Сохранить",
  cancelLabel = "Отмена",
  busy,
  disabled,
  danger,
  left
}: {
  onCancel: () => void;
  onSubmit?: () => void;
  submitLabel?: ReactNode;
  cancelLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  danger?: boolean;
  left?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-2 pt-1.5">
      {left}
      <div className="flex flex-1 gap-2">
        <button type="button" className={cn(PAYROLL_BTN.secondary, !onSubmit && "flex-1")} onClick={onCancel}>
          {cancelLabel}
        </button>
        {onSubmit ? (
          <button type="button" className={cn(danger ? PAYROLL_BTN.danger : PAYROLL_BTN.primary, "flex-1")} disabled={busy || disabled} onClick={onSubmit}>
            {busy ? <Loader2 className="animate-spin" aria-hidden /> : null}
            {submitLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function PayrollDeleteButton({ onClick, disabled, label = "Удалить" }: { onClick: () => void; disabled?: boolean; label?: string }) {
  return (
    <button type="button" className={PAYROLL_BTN.dangerGhost} disabled={disabled} onClick={onClick}>
      <Trash2 aria-hidden /> {label}
    </button>
  );
}

type ConfirmOptions = { title?: string; message: string; detail?: string; confirmLabel?: string; cancelLabel?: string; destructive?: boolean };

/** Same API as `useAppConfirm`, styled as the template's confirmation modal. */
export function usePayrollConfirm() {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((messageOrOpts: string | ConfirmOptions) => {
    const next = typeof messageOrOpts === "string" ? { message: messageOrOpts } : messageOrOpts;
    return new Promise<boolean>((resolve) => {
      resolver.current?.(false);
      resolver.current = resolve;
      setOpts(next);
    });
  }, []);

  const close = useCallback((value: boolean) => {
    resolver.current?.(value);
    resolver.current = null;
    setOpts(null);
  }, []);

  const destructive = opts?.destructive ?? true;
  const dialog = (
    <PayrollModal open={opts != null} onClose={() => close(false)} title={opts?.title ?? "Подтверждение"} width="sm:max-w-[400px]">
      <div className="flex items-start gap-3.5">
        <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-full", destructive ? "bg-rose-50 text-rose-500 dark:bg-rose-500/10" : "bg-amber-50 text-amber-500 dark:bg-amber-500/10")}>
          {destructive ? <Trash2 className="size-5" aria-hidden /> : <AlertTriangle className="size-5" aria-hidden />}
        </div>
        <div className="min-w-0 pt-0.5">
          <p className="text-[13.5px] leading-relaxed text-foreground/75">{opts?.message}</p>
          {opts?.detail ? <p className="mt-1 text-[13px] font-semibold text-foreground">{opts.detail}</p> : null}
        </div>
      </div>
      <div className="mt-5 flex gap-2">
        <button type="button" className={cn(PAYROLL_BTN.secondary, "flex-1")} onClick={() => close(false)}>
          {opts?.cancelLabel ?? "Отмена"}
        </button>
        <button type="button" className={cn(destructive ? PAYROLL_BTN.danger : PAYROLL_BTN.primary, "flex-1")} onClick={() => close(true)}>
          {opts?.confirmLabel ?? "Да"}
        </button>
      </div>
    </PayrollModal>
  );

  return { confirm, dialog };
}
