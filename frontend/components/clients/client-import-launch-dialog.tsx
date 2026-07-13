"use client";

import { cn } from "@/lib/utils";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "update";
  busy?: boolean;
  onDownloadTemplate: () => Promise<void> | void;
  onConfirm: (file: File) => void;
};

/** Zip shablon ImportModal — 700px, 2 ustunli grid, backdrop blur */
export function ClientImportLaunchDialog({
  open,
  onOpenChange,
  mode,
  busy = false,
  onDownloadTemplate,
  onConfirm
}: Props) {
  const hiddenInputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const reset = useCallback(() => {
    setFile(null);
    setErr(null);
    if (hiddenInputRef.current) hiddenInputRef.current.value = "";
  }, []);

  const close = useCallback(() => {
    reset();
    onOpenChange(false);
  }, [onOpenChange, reset]);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (panelRef.current?.contains(t)) return;
      close();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, close]);

  if (!open || typeof document === "undefined") return null;

  const title = mode === "update" ? "Обновление клиентов с Excel" : "Импорт клиент";

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex animate-in fade-in items-center justify-center bg-[#013532]/30 backdrop-blur-[1px] duration-150"
      role="presentation"
    >
      <div
        ref={panelRef}
        className="mx-4 w-full max-w-[700px] overflow-hidden rounded-2xl bg-card shadow-2xl"
        role="dialog"
        aria-modal
        aria-labelledby="client-import-launch-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4">
          <h3 id="client-import-launch-title" className="text-lg font-bold text-gray-800">
            {title}
          </h3>
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={busy}
              className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-muted disabled:opacity-60"
              onClick={() => void onDownloadTemplate()}
            >
              <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
              Скачать шаблон
            </button>
            <button
              type="button"
              onClick={close}
              className="rounded-lg p-1 transition-colors hover:bg-muted"
              aria-label="Закрыть"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 px-6 pb-6">
          <button
            type="button"
            disabled={busy}
            onClick={() => hiddenInputRef.current?.click()}
            className="flex items-center justify-center gap-2 rounded-lg border border-border bg-card py-3 text-sm font-medium text-gray-600 transition-colors hover:border-border hover:bg-muted disabled:opacity-60"
          >
            <Upload className="h-4 w-4 shrink-0 text-gray-500" />
            <span className="truncate">{file ? file.name : "Выберите Excel файл"}</span>
          </button>
          <input
            ref={hiddenInputRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            onChange={(e) => {
              setErr(null);
              setFile(e.target.files?.[0] ?? null);
            }}
          />
          <button
            type="button"
            disabled={busy || !file}
            className={cn(
              "rounded-lg py-3 text-sm font-bold text-white transition-colors",
              file && !busy
                ? "bg-emerald-500 hover:bg-emerald-600"
                : "cursor-not-allowed bg-emerald-300"
            )}
            onClick={() => {
              if (!file) {
                setErr("Сначала выберите Excel файл.");
                return;
              }
              onConfirm(file);
            }}
          >
            Сохранить
          </button>
        </div>
        {err ? <p className="px-6 pb-4 text-xs text-red-600">{err}</p> : null}
      </div>
    </div>,
    document.body
  );
}
