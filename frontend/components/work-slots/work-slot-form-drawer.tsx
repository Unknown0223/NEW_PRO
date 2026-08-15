"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  agentModalBtnCancel,
  agentModalBtnPrimary,
  agentModalBtnSaveGradient
} from "@/components/staff/agent-workspace-template-ui";

type Props = {
  open: boolean;
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Primary action label when using built-in footer */
  submitLabel?: string;
  onSubmit?: () => void;
  submitDisabled?: boolean;
  submitBusy?: boolean;
  submitError?: string | null;
  widthClass?: string;
  /** Use gradient save button (Agent style) */
  gradientSubmit?: boolean;
};

export function WorkSlotFormDrawer({
  open,
  title,
  subtitle,
  onClose,
  children,
  footer,
  submitLabel = "Сохранить",
  onSubmit,
  submitDisabled,
  submitBusy,
  submitError,
  widthClass = "sm:max-w-2xl lg:max-w-3xl",
  gradientSubmit = true
}: Props) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto p-4 sm:p-6">
      <div
        className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
        aria-hidden
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="work-slot-drawer-title"
        className={cn(
          "animate-add-product-modal relative my-auto flex max-h-[min(92vh,920px)] w-full flex-col overflow-hidden rounded-2xl bg-card shadow-2xl",
          widthClass
        )}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-border px-5 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="work-slot-drawer-title" className="text-lg font-semibold text-slate-900">
              {title}
            </h2>
            {subtitle ? <div className="mt-0.5 text-sm text-slate-500">{subtitle}</div> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-500 transition hover:bg-muted hover:text-slate-900"
            aria-label="Закрыть"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6">
          {children}
        </div>

        {footer !== undefined ? (
          footer
        ) : onSubmit ? (
          <div className="shrink-0 border-t border-border bg-muted/30 px-5 py-4 sm:px-6">
            {submitError ? <p className="mb-3 text-sm text-destructive">{submitError}</p> : null}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} className={agentModalBtnCancel}>
                Отмена
              </button>
              <button
                type="button"
                disabled={submitDisabled || submitBusy}
                onClick={onSubmit}
                className={gradientSubmit ? agentModalBtnSaveGradient : agentModalBtnPrimary}
              >
                {submitBusy ? "…" : submitLabel}
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
