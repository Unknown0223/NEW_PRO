"use client";

import { RotateCcw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

type Props = {
  selectedCount: number;
  total: number;
  onRestore: () => void;
  onClear: () => void;
  restoreDisabled?: boolean;
  restoreHint?: string;
};

/** Arxiv (удалённые) ko'rinishidagi «Восстановить» paneli — tanlangan to'lovlarni tiklash. */
export function EprRestoreActionBar({
  selectedCount,
  total,
  onRestore,
  onClear,
  restoreDisabled = false,
  restoreHint
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
      aria-label="Действия с удалёнными заявками"
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
          onClick={onRestore}
          disabled={restoreDisabled}
          title={restoreHint ?? "Восстановить выбранные оплаты"}
          className="inline-flex items-center gap-1.5 rounded-full bg-teal-700 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <RotateCcw className="size-4" />
          Восстановить
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
