"use client";

import { Check, Loader2, Save, Share2, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

export type SavedPivotReportItemProps = {
  id: number;
  name: string;
  selected: boolean;
  loading?: boolean;
  /** Ochilgandan keyin o‘zgarishlar bor — Сохранить faol */
  dirty?: boolean;
  saveDisabled?: boolean;
  shareDisabled?: boolean;
  suffix?: string;
  dense?: boolean;
  onSelect: () => void;
  onSave: () => void;
  onShare?: () => void;
  onDelete: () => void;
};

/** Saqlangan hisobot: tanlash + Сохранить/Поделиться/o‘chirish (faqat tanlanganda). */
export function SavedPivotReportItem({
  name,
  selected,
  loading,
  dirty,
  saveDisabled,
  shareDisabled,
  suffix,
  dense,
  onSelect,
  onSave,
  onShare,
  onDelete
}: SavedPivotReportItemProps) {
  return (
    <div
      className={cn(
        "group flex min-w-0 max-w-full items-stretch overflow-hidden rounded-md border text-left transition-colors",
        selected
          ? "border-amber-500 bg-amber-50 text-amber-950 shadow-sm ring-2 ring-amber-400/70 dark:border-amber-400 dark:bg-amber-950/40 dark:text-amber-50 dark:ring-amber-500/50"
          : "border-border bg-background hover:border-muted-foreground/40 hover:bg-muted/40"
      )}
      data-selected={selected ? "true" : "false"}
      data-dirty={selected && dirty ? "true" : "false"}
    >
      <button
        type="button"
        className={cn(
          "flex min-w-0 flex-1 items-center gap-1.5 px-2 text-left outline-none",
          dense ? "h-7 text-[10px]" : "h-9 text-xs"
        )}
        title={name}
        disabled={loading}
        onClick={onSelect}
      >
        {loading ? (
          <Loader2 className={cn("shrink-0 animate-spin", dense ? "h-3 w-3" : "h-3.5 w-3.5")} />
        ) : selected ? (
          <Check
            className={cn("shrink-0 text-amber-600 dark:text-amber-300", dense ? "h-3 w-3" : "h-3.5 w-3.5")}
            aria-hidden
          />
        ) : null}
        <span className="min-w-0 truncate font-medium">
          {name}
          {suffix ? <span className="font-normal opacity-70">{suffix}</span> : null}
        </span>
        {selected ? (
          <span
            className={cn(
              "shrink-0 rounded px-1 font-normal uppercase tracking-wide",
              dirty
                ? "bg-amber-200/80 text-amber-950 dark:bg-amber-700/60 dark:text-amber-50"
                : "text-amber-800/80 dark:text-amber-200/80",
              dense ? "text-[8px]" : "text-[9px]"
            )}
          >
            {dirty ? "изм." : "выбр."}
          </span>
        ) : null}
      </button>
      {selected ? (
        <div className="flex shrink-0 items-center border-l border-amber-300/80 dark:border-amber-700">
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center outline-none disabled:opacity-40",
              dirty
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
              dense ? "h-7 w-7" : "h-9 w-9"
            )}
            title={
              dirty
                ? "Сохранить изменения в этом отчёте"
                : "Нет изменений — отчёт уже сохранён"
            }
            aria-label={`Сохранить «${name}»`}
            disabled={loading || saveDisabled || !dirty}
            onClick={(e) => {
              e.stopPropagation();
              onSave();
            }}
          >
            <Save className={dense ? "h-3 w-3" : "h-3.5 w-3.5"} />
          </button>
          {onShare ? (
            <button
              type="button"
              className={cn(
                "inline-flex items-center justify-center text-muted-foreground outline-none hover:bg-muted hover:text-foreground disabled:opacity-40",
                dense ? "h-7 w-7" : "h-9 w-9"
              )}
              title="Поделиться"
              aria-label={`Поделиться «${name}»`}
              disabled={loading || shareDisabled}
              onClick={(e) => {
                e.stopPropagation();
                onShare();
              }}
            >
              <Share2 className={dense ? "h-3 w-3" : "h-3.5 w-3.5"} />
            </button>
          ) : null}
          <button
            type="button"
            className={cn(
              "inline-flex items-center justify-center text-muted-foreground outline-none hover:bg-destructive/10 hover:text-destructive disabled:opacity-40",
              dense ? "h-7 w-7" : "h-9 w-9"
            )}
            title="Удалить"
            aria-label={`Удалить «${name}»`}
            disabled={loading}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <Trash2 className={dense ? "h-3 w-3" : "h-3.5 w-3.5"} />
          </button>
        </div>
      ) : null}
    </div>
  );
}
