"use client";

import { AlertTriangle, Trash2 } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { TemplateModal } from "@/components/payments/client-payments/template-modal";
import { cn } from "@/lib/utils";

export type AppConfirmOptions = {
  title?: string;
  message: string;
  detail?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type DialogProps = AppConfirmOptions & {
  open: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/** Brauzerning `confirm()` o‘rniga — ilova uslubidagi Да / Нет modal. */
export function AppConfirmDialog({
  open,
  title = "Подтверждение",
  message,
  detail,
  confirmLabel = "Да",
  cancelLabel = "Нет",
  destructive = true,
  busy = false,
  onCancel,
  onConfirm
}: DialogProps) {
  return (
    <TemplateModal
      open={open}
      onClose={busy ? () => undefined : onCancel}
      title={title}
      maxWidth="max-w-sm"
    >
      <div className="space-y-4">
        <div className="flex justify-center">
          <div
            className={cn(
              "grid size-10 place-items-center rounded-full",
              destructive ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-600"
            )}
          >
            {destructive ? <Trash2 className="size-5" /> : <AlertTriangle className="size-5" />}
          </div>
        </div>
        <p className="text-center text-sm font-medium text-slate-700">{message}</p>
        {detail ? <p className="text-center text-xs text-slate-500">{detail}</p> : null}
        <div className="flex items-center justify-end gap-2 border-t border-border pt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-border px-4 py-2 text-sm text-slate-700 hover:bg-muted disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              "rounded-md px-5 py-2 text-sm font-medium text-white disabled:opacity-50",
              destructive ? "bg-red-600 hover:bg-red-700" : "bg-teal-600 hover:bg-teal-700"
            )}
          >
            {busy ? "…" : confirmLabel}
          </button>
        </div>
      </div>
    </TemplateModal>
  );
}

export function useAppConfirm() {
  const [opts, setOpts] = useState<AppConfirmOptions | null>(null);
  const resolver = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback((messageOrOpts: string | AppConfirmOptions) => {
    const next: AppConfirmOptions =
      typeof messageOrOpts === "string" ? { message: messageOrOpts } : messageOrOpts;
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

  const dialog = (
    <AppConfirmDialog
      open={Boolean(opts)}
      title={opts?.title}
      message={opts?.message ?? ""}
      detail={opts?.detail}
      confirmLabel={opts?.confirmLabel}
      cancelLabel={opts?.cancelLabel}
      destructive={opts?.destructive ?? true}
      onCancel={() => close(false)}
      onConfirm={() => close(true)}
    />
  );

  return { confirm, dialog };
}
