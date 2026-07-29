"use client";

import { cn } from "@/lib/utils";
import { FileSpreadsheet, Upload, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ExcelFileDropZone } from "@/components/ui/excel-file-drop-zone";

export type StaffImportResultPayload = {
  created: number;
  updated: number;
  errors: string[];
  importStats?: {
    totalRows: number;
    processedRows: number;
    skippedEmpty: number;
  };
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  busy?: boolean;
  result?: StaffImportResultPayload | null;
  onDownloadTemplate: () => Promise<void> | void;
  onConfirm: (file: File) => void;
  onClearResult?: () => void;
};

/** Диалог импорта сотрудников из Excel (шаблон + файл + результат). */
export function StaffImportDialog({
  open,
  onOpenChange,
  title = "Импорт Excel",
  busy = false,
  result = null,
  onDownloadTemplate,
  onConfirm,
  onClearResult
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const reset = useCallback(() => {
    setFile(null);
    setErr(null);
  }, []);

  const close = useCallback(() => {
    reset();
    onClearResult?.();
    onOpenChange(false);
  }, [onClearResult, onOpenChange, reset]);

  useEffect(() => {
    if (!open) reset();
  }, [open, reset]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, busy, close]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex animate-in fade-in items-center justify-center bg-[#013532]/30 backdrop-blur-[1px] duration-150"
      role="presentation"
    >
      <div
        ref={panelRef}
        className="mx-4 w-full max-w-[720px] overflow-hidden rounded-2xl bg-card shadow-2xl"
        role="dialog"
        aria-modal
        aria-labelledby="staff-import-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4">
          <h3 id="staff-import-title" className="text-lg font-bold text-gray-800">
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
              disabled={busy}
              onClick={close}
              className="rounded-lg p-1 transition-colors hover:bg-muted"
              aria-label="Закрыть"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 px-6 pb-4">
          <ExcelFileDropZone
            file={file}
            disabled={busy}
            emptyLabel="Выберите Excel файл"
            dropHint="или перетащите сюда"
            onFile={(f) => {
              setErr(null);
              onClearResult?.();
              setFile(f);
            }}
            onInvalid={(msg) => setErr(msg)}
          />
          <button
            type="button"
            disabled={busy || !file}
            className={cn(
              "flex items-center justify-center gap-2 rounded-lg py-3 text-sm font-bold text-white transition-colors",
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
            <Upload className="h-4 w-4" />
            {busy ? "Импорт…" : "Импортировать"}
          </button>
        </div>

        {err ? <p className="px-6 pb-2 text-xs text-red-600">{err}</p> : null}

        {result ? (
          <div className="mx-6 mb-5 max-h-56 overflow-auto rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
            <p className="font-medium text-slate-800">
              Создано: {result.created}, обновлено: {result.updated}
              {result.errors.length ? `, ошибок: ${result.errors.length}` : ""}
            </p>
            {result.importStats ? (
              <p className="mt-1 text-xs text-slate-500">
                Строк в файле: {result.importStats.totalRows}, обработано:{" "}
                {result.importStats.processedRows}, пустых: {result.importStats.skippedEmpty}
              </p>
            ) : null}
            {result.errors.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-red-700">
                {result.errors.slice(0, 40).map((e) => (
                  <li key={e}>{e}</li>
                ))}
                {result.errors.length > 40 ? (
                  <li>…и ещё {result.errors.length - 40}</li>
                ) : null}
              </ul>
            ) : (
              <p className="mt-1 text-xs text-emerald-700">Импорт завершён без ошибок.</p>
            )}
          </div>
        ) : (
          <p className="px-6 pb-5 text-xs text-slate-500">
            Сопоставление по логину или коду: существующие сотрудники обновляются, новые — создаются.
            Если пароль не указан, для новых используется Parol123!
          </p>
        )}
      </div>
    </div>,
    document.body
  );
}
