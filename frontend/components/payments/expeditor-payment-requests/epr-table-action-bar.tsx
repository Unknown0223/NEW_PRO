"use client";

import { Check, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  selectedCount: number;
  confirmDisabled?: boolean;
  deleteDisabled?: boolean;
  onConfirm: () => void;
  onDelete: () => void;
  className?: string;
};

/** Pastki «Подтверждение» / «Удалить» — referens UI (1–2-rasmlar). */
export function EprTableActionBar({
  selectedCount,
  confirmDisabled = false,
  deleteDisabled = false,
  onConfirm,
  onDelete,
  className
}: Props) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 border-t border-border bg-card px-4 py-3",
        className
      )}
    >
      <button
        type="button"
        onClick={onConfirm}
        disabled={confirmDisabled}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-teal-700 px-6 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Check className="size-4" />
        Подтверждение
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={deleteDisabled}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-red-600 px-6 text-sm font-semibold text-white shadow-sm hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-45"
      >
        <Trash2 className="size-4" />
        Удалить
      </button>
      {selectedCount > 0 ? (
        <span className="text-xs text-slate-500">
          Выбрано: <span className="font-semibold text-slate-700">{selectedCount}</span>
        </span>
      ) : (
        <span className="text-xs text-slate-400">Отметьте заявки в таблице слева</span>
      )}
    </div>
  );
}
