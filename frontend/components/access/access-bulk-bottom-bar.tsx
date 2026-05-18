"use client";

import { Link2, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type AccessBulkBottomBarVariant = "operations" | "scope";

type AccessBulkBottomBarProps = {
  variant: AccessBulkBottomBarVariant;
  selectedCount: number;
  totalVisibleCount: number;
  onClear: () => void;
  onDetach: () => void;
  busy?: boolean;
  /** «Запретить»: для операций — снять эффект; для складов — только «для себя» (см. title). */
  onDeny?: () => void;
  /** Подсказка для кнопки «Запретить» */
  denyTitle?: string;
  /** Иконка у кнопки «Открепить» (матрица операций пользователя) */
  detachWithLinkIcon?: boolean;
  className?: string;
};

/**
 * Компактная нижняя панель: подряд [×][N выбрано из M] … [Запретить][Открепить]
 * (без растягивания блоков — пустое место по центру не тянется).
 */
export function AccessBulkBottomBar({
  variant,
  selectedCount,
  totalVisibleCount,
  onClear,
  onDetach,
  busy,
  onDeny,
  denyTitle,
  detachWithLinkIcon,
  className
}: AccessBulkBottomBarProps) {
  const showDeny = typeof onDeny === "function";
  return (
    <div
      className={cn("pointer-events-none shrink-0 px-2 pb-2 pt-0.5 sm:px-2.5 sm:pb-2.5", className)}
      role="presentation"
    >
      <div
        role="toolbar"
        aria-label="Массовые действия"
        data-bulk-variant={variant}
        aria-busy={busy || undefined}
        className={cn(
          "pointer-events-auto flex h-9 w-full min-w-0 max-w-full flex-nowrap items-center gap-1.5 rounded-md border border-border/80 bg-gradient-to-r from-emerald-50/70 via-background to-background py-0 pl-1.5 pr-1.5 shadow-sm ring-1 ring-teal-600/10 dark:from-emerald-950/40 dark:via-card dark:to-card dark:border-border dark:ring-emerald-500/15 sm:gap-2 sm:pl-2 sm:pr-2",
          "border-l-[3px] border-l-teal-600",
          busy && "opacity-[0.88]"
        )}
      >
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 w-7 shrink-0 rounded border-border bg-background p-0 text-muted-foreground shadow-none hover:bg-muted/70 hover:text-foreground dark:border-border"
          onClick={onClear}
          disabled={busy}
          aria-label="Снять выделение"
          title="Снять выделение"
        >
          <X className="mx-auto h-3.5 w-3.5" aria-hidden />
        </Button>
        <p className="min-w-0 shrink truncate text-[11px] leading-tight text-muted-foreground sm:text-xs">
          <span className="tabular-nums font-semibold text-foreground">{selectedCount}</span>
          <span className="font-normal"> выбрано из </span>
          <span className="tabular-nums font-semibold text-foreground">{totalVisibleCount}</span>
        </p>

        <div className="ml-auto flex shrink-0 flex-nowrap items-center gap-1">
          {busy ? (
            <span
              className="flex shrink-0 items-center gap-1 text-[10px] text-teal-700 dark:text-emerald-400"
              aria-live="polite"
              title="Сохранение"
            >
              <Loader2 className="h-3 w-3 shrink-0 animate-spin" aria-hidden />
            </span>
          ) : null}
          {showDeny ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 shrink-0 whitespace-nowrap border-teal-700/25 bg-background/90 px-2 text-[11px] font-medium leading-none shadow-none hover:bg-emerald-50/80 hover:border-teal-600/35 dark:border-emerald-600/30 dark:hover:bg-emerald-950/50 sm:px-2.5"
              disabled={busy}
              title={denyTitle ?? "Запретить для выбранных строк"}
              onClick={onDeny}
            >
              Запретить
            </Button>
          ) : null}
          <Button
            type="button"
            size="sm"
            className="h-7 shrink-0 gap-1 whitespace-nowrap rounded-md border-0 bg-teal-600 px-2 text-[11px] font-semibold leading-none text-white shadow-none hover:bg-teal-700 disabled:opacity-50 dark:bg-emerald-600 dark:hover:bg-emerald-500 sm:px-2.5"
            disabled={busy}
            onClick={onDetach}
          >
            {detachWithLinkIcon ? <Link2 className="h-3 w-3 shrink-0" aria-hidden /> : null}
            Открепить
          </Button>
        </div>
      </div>
    </div>
  );
}
