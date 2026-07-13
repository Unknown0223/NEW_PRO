"use client";

import { isSoftVoidUiEnabled } from "@/lib/feature-flags";
import { AlertTriangle } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
  title?: string;
  description?: string;
  /** Moliyaviy obyektlarda sabab majburiy. */
  reasonRequired?: boolean;
  reasonPlaceholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  pending?: boolean;
  /** Qo‘shimcha oqibatlar / ogohlantirishlar. */
  consequences?: string[];
  error?: string | null;
  children?: ReactNode;
};

/**
 * Umumiy soft-void tasdiqlash dialogi.
 * DELETE = arxiv (void); sabab moliyada majburiy bo‘lishi mumkin.
 */
export function SoftVoidConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Аннулировать",
  description = "Запись будет перемещена в архив и может быть восстановлена позже.",
  reasonRequired = false,
  reasonPlaceholder = "Причина",
  confirmLabel = "Аннулировать",
  cancelLabel = "Отмена",
  pending = false,
  consequences,
  error,
  children
}: Props) {
  const [reason, setReason] = useState("");
  const [localErr, setLocalErr] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setReason("");
      setLocalErr(null);
    }
  }, [open]);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // SOFT_VOID_V1=0 / NEXT_PUBLIC_SOFT_VOID_V1=0 — arxiv UI o‘chiriladi (backend soft-void qoladi).
  if (!isSoftVoidUiEnabled() || !open) return null;

  const handleConfirm = async () => {
    const trimmed = reason.trim();
    if (reasonRequired && !trimmed) {
      setLocalErr("Укажите причину");
      return;
    }
    setLocalErr(null);
    await onConfirm(trimmed);
  };

  const displayErr = localErr ?? error ?? null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="fixed inset-0 bg-black/40" onClick={pending ? undefined : onClose} aria-hidden />
      <div className="relative z-10 mx-4 w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-lg bg-card shadow-2xl">
        <div className="border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        </div>
        <div className="space-y-4 px-6 py-4">
          <div className="flex justify-center">
            <AlertTriangle className="h-10 w-10 text-amber-500" />
          </div>
          <p className="text-center text-sm text-slate-700">{description}</p>

          {consequences && consequences.length > 0 ? (
            <ul className="list-disc space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              {consequences.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          ) : null}

          {children}

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {reasonPlaceholder}
              {reasonRequired ? " *" : ""}
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              disabled={pending}
              placeholder={reasonPlaceholder}
              className="w-full resize-none rounded-lg border border-border px-3 py-2.5 text-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-200 disabled:opacity-60"
            />
          </div>

          {displayErr ? <p className="text-sm text-red-600">{displayErr}</p> : null}

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={pending}
              className="flex-1 rounded-lg border border-border bg-card py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-muted disabled:opacity-60"
            >
              {cancelLabel}
            </button>
            <button
              type="button"
              onClick={() => void handleConfirm()}
              disabled={pending}
              className="flex-1 rounded-lg bg-red-500 py-2.5 text-sm font-medium text-white transition-colors hover:bg-red-600 disabled:opacity-60"
            >
              {pending ? "…" : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
