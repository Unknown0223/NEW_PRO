"use client";

import { useEffect, useRef, useState } from "react";
import { Copy, MoreVertical } from "lucide-react";
import { cn } from "@/lib/utils";

const ICON_BTN = "rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";
const MENU_ITEM = "w-full rounded-md px-2.5 py-2 text-left text-[12.5px] text-foreground/80 hover:bg-muted";
const FN_CHIP =
  "rounded-md border border-[var(--pr-field)] bg-[var(--pr-head)] px-2 py-1 text-[11px] font-bold text-foreground/70 transition-colors hover:border-[var(--pr-brand-200)] hover:bg-[var(--pr-brand-50)] hover:text-[var(--pr-brand-700)]";

type Props = {
  canEdit: boolean;
  manual: boolean;
  functions: string[];
  onCopy: () => void;
  onPaste: () => void;
  onToggleManual: () => void;
  onClear: () => void;
  onInsert: (text: string) => void;
};

/** Canvas chip box (template): copy + ⋮ menu with clipboard actions and the full function list. */
export function PayrollFormulaToolbar({ canEdit, manual, functions, onCopy, onPaste, onToggleManual, onClear, onInsert }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);
  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className="inline-flex h-[30px] items-center gap-0.5 rounded-[10px] border border-[var(--pr-field)] bg-card px-1 shadow-sm">
      <button type="button" onClick={onCopy} aria-label="Копировать формулу" title="Копировать" className={ICON_BTN}>
        <Copy className="size-4" />
      </button>
      <span className="relative" ref={ref}>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-label="Действия" aria-expanded={open} className={ICON_BTN}>
          <MoreVertical className="size-4" />
        </button>
        {open ? (
          <div className="absolute left-0 top-8 z-30 w-60 rounded-lg border border-[var(--pr-border)] bg-card p-1.5 shadow-[0_4px_6px_-2px_rgb(16_42_38/0.06),0_12px_28px_-6px_rgb(16_42_38/0.16)]">
            <button type="button" onClick={run(onCopy)} className={MENU_ITEM}>Копировать всё</button>
            {canEdit ? (
              <>
                <button type="button" onClick={run(onPaste)} className={MENU_ITEM}>Вставить</button>
                <button type="button" onClick={run(onToggleManual)} className={MENU_ITEM}>{manual ? "Скрыть ручной ввод" : "Ввести вручную"}</button>
                <button type="button" onClick={run(onClear)} className={cn(MENU_ITEM, "text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10")}>Очистить всё</button>
              </>
            ) : null}
            {canEdit && functions.length ? (
              <div className="mt-1 border-t border-[var(--pr-line)] px-1 pb-0.5 pt-2">
                <p className="mb-1.5 px-1 text-[10.5px] font-bold uppercase tracking-wide text-muted-foreground/80">Функции</p>
                <div className="flex flex-wrap gap-1">
                  {functions.map((fn) => (
                    <button key={fn} type="button" onClick={run(() => onInsert(`${fn}(`))} className={FN_CHIP}>
                      {fn}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </span>
    </div>
  );
}
