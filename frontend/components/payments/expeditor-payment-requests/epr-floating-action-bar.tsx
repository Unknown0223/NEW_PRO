"use client";

import { Check, Trash2, Undo2, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type Props = {
  selectedCount: number;
  total: number;
  onConfirm: () => void;
  onDelete: () => void;
  onReturn: () => void;
  onClear: () => void;
  confirmDisabled?: boolean;
  deleteDisabled?: boolean;
  returnDisabled?: boolean;
  confirmHint?: string;
  deleteHint?: string;
  returnHint?: string;
};

export function EprFloatingActionBar({
  selectedCount,
  total,
  onConfirm,
  onDelete,
  onReturn,
  onClear,
  confirmDisabled = false,
  deleteDisabled = false,
  returnDisabled = false,
  confirmHint,
  deleteHint,
  returnHint
}: Props) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (selectedCount > 0) {
      setVisible(true);
      return;
    }
    const h = setTimeout(() => setVisible(false), 250);
    return () => clearTimeout(h);
  }, [selectedCount]);

  if (!mounted) return null;
  if (!visible && selectedCount === 0) return null;

  const bar = (
    <div
      role="toolbar"
      aria-label="Действия с выбранными заявками"
      className={cn(
        "fixed inset-x-0 bottom-4 z-[200] flex justify-center px-3 transition-all duration-200",
        !visible && "pointer-events-none translate-y-24 opacity-0"
      )}
    >
      <div className="flex max-w-full flex-wrap items-center justify-center gap-2 rounded-full border border-teal-600/40 bg-card px-2 py-2 shadow-[0_8px_40px_rgba(6,59,54,0.28)]">
        <span className="rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-slate-700">
          Выбрано: <span className="text-teal-700">{selectedCount}</span> / {total}
        </span>

        <button
          type="button"
          onClick={onConfirm}
          disabled={confirmDisabled}
          title={
            confirmHint ??
            (confirmDisabled ? "Доступно только для заявок «Ожидание подтверждения»" : "Подтвердить выбранные")
          }
          className="inline-flex items-center gap-1.5 rounded-full bg-teal-700 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Check className="size-4" />
          Подтверждение
        </button>

        <button
          type="button"
          onClick={onReturn}
          disabled={returnDisabled}
          title={
            returnHint ??
            (returnDisabled
              ? "Возврат недоступен для выбранных"
              : "Вернуть оплату экспедитору на исправление")
          }
          className="inline-flex items-center gap-1.5 rounded-full bg-amber-500 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Undo2 className="size-4" />
          Вернуть экспедитору
        </button>

        <button
          type="button"
          onClick={onDelete}
          disabled={deleteDisabled}
          title={deleteHint ?? (deleteDisabled ? "Удаление недоступно" : "Удалить / отклонить выбранные")}
          className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <Trash2 className="size-4" />
          Удалить
        </button>

        <span className="mx-1 hidden h-6 w-px bg-muted sm:block" />

        <button
          type="button"
          onClick={onClear}
          title="Сбросить выбор"
          className="grid size-8 place-items-center rounded-full text-slate-500 hover:bg-muted hover:text-slate-700"
          aria-label="Сбросить выбор"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );

  return createPortal(bar, document.body);
}
