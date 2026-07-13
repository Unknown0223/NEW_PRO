"use client";

import { cn } from "@/lib/utils";
import {
  EXCEL_ACCEPT,
  EXCEL_OR_CSV_ACCEPT,
  pickFirstExcelFile,
  type ExcelPickOptions
} from "@/lib/excel-file-pick";
import { Upload } from "lucide-react";
import {
  useCallback,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type ReactNode
} from "react";

type ExcelFileDropZoneProps = {
  file?: File | null;
  disabled?: boolean;
  allowCsv?: boolean;
  emptyLabel?: string;
  dropHint?: string;
  className?: string;
  onFile: (file: File) => void;
  onInvalid?: (message: string) => void;
  /** Agar berilsa — yashirin input shu ref ga ulanadi */
  inputId?: string;
  children?: ReactNode;
};

/**
 * Excel faylni bosib tanlash yoki Explorer dan surib tashlash.
 * Ko‘rinadigan «Выберите Excel файл» zonasi uchun.
 */
export function ExcelFileDropZone({
  file = null,
  disabled = false,
  allowCsv = false,
  emptyLabel = "Выберите Excel файл",
  dropHint = "или перетащите сюда",
  className,
  onFile,
  onInvalid,
  inputId,
  children
}: ExcelFileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);

  const opts: ExcelPickOptions = { allowCsv };
  const accept = allowCsv ? EXCEL_OR_CSV_ACCEPT : EXCEL_ACCEPT;

  const applyFile = useCallback(
    (picked: File | null) => {
      if (!picked) {
        onInvalid?.(
          allowCsv
            ? "Нужен файл Excel (.xlsx, .xls) или CSV."
            : "Нужен файл Excel (.xlsx, .xls)."
        );
        return;
      }
      onFile(picked);
    },
    [allowCsv, onFile, onInvalid]
  );

  const onInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = pickFirstExcelFile(e.target.files, opts);
    applyFile(picked);
    e.target.value = "";
  };

  const onDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    dragDepth.current += 1;
    setDragging(true);
  };

  const onDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) e.dataTransfer.dropEffect = "copy";
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDragging(false);
    if (disabled) return;
    applyFile(pickFirstExcelFile(e.dataTransfer.files, opts));
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onClick={() => {
        if (!disabled) inputRef.current?.click();
      }}
      onKeyDown={(e) => {
        if (disabled) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          inputRef.current?.click();
        }
      }}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
      className={cn(
        "flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-border bg-card py-3 text-sm font-medium text-gray-600 transition-colors",
        "hover:border-border hover:bg-muted",
        dragging && "border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-500/30",
        disabled && "pointer-events-none cursor-not-allowed opacity-60",
        className
      )}
    >
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        disabled={disabled}
        onChange={onInputChange}
      />
      {children ?? (
        <>
          <Upload className={cn("h-4 w-4 shrink-0", dragging ? "text-emerald-600" : "text-gray-500")} />
          <span className="min-w-0 truncate">
            {file ? file.name : dragging ? "Отпустите файл…" : emptyLabel}
          </span>
          {!file && !dragging ? (
            <span className="hidden text-xs font-normal text-muted-foreground sm:inline">{dropHint}</span>
          ) : null}
        </>
      )}
    </div>
  );
}

type ExcelDropTargetProps = {
  disabled?: boolean;
  allowCsv?: boolean;
  className?: string;
  onFile: (file: File) => void;
  onInvalid?: (message: string) => void;
  children: ReactNode;
};

/**
 * Toolbar tugmasi atrofida drag-drop: faylni tugmaga tashlash mumkin.
 */
export function ExcelDropTarget({
  disabled = false,
  allowCsv = false,
  className,
  onFile,
  onInvalid,
  children
}: ExcelDropTargetProps) {
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const opts: ExcelPickOptions = { allowCsv };

  const onDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled) return;
    dragDepth.current += 1;
    setDragging(true);
  };

  const onDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  };

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) e.dataTransfer.dropEffect = "copy";
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setDragging(false);
    if (disabled) return;
    const picked = pickFirstExcelFile(e.dataTransfer.files, opts);
    if (!picked) {
      onInvalid?.(
        allowCsv
          ? "Нужен файл Excel (.xlsx, .xls) или CSV."
          : "Нужен файл Excel (.xlsx, .xls)."
      );
      return;
    }
    onFile(picked);
  };

  return (
    <div
      className={cn(
        "inline-flex rounded-md transition-shadow",
        dragging && "ring-2 ring-emerald-500/40 ring-offset-1",
        className
      )}
      onDragEnter={onDragEnter}
      onDragLeave={onDragLeave}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      {children}
    </div>
  );
}
