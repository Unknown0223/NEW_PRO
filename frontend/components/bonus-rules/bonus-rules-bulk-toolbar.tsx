"use client";

import type { BonusRuleRow } from "@/components/bonus-rules/bonus-rule-types";
import { BulkToolbarDropdownPortal } from "@/components/orders/orders-list/bulk-toolbar-dropdown-portal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { getUserFacingError } from "@/lib/error-utils";
import { formatGroupedInteger } from "@/lib/format-numbers";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, ChevronDown, Link2, Power, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Ikkinchi «Настройки» paneli kengligi — pastki panel va dialog markazlash uchun */
const SETTINGS_ASIDE_PX = 300;

const toolbarBtn =
  "flex shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-muted disabled:opacity-50 dark:border-input dark:bg-background dark:text-foreground dark:hover:bg-muted/50";

type BulkPatch = {
  is_active?: boolean;
  valid_to?: string | null;
  extend_days?: number;
};

type Props = {
  tenantSlug: string;
  selectedIds: Set<number>;
  selectedRows: BonusRuleRow[];
  activeOnly: boolean;
  onClearSelection: () => void;
  onScopeBulk: () => void;
};

export function BonusRulesBulkToolbar({
  tenantSlug,
  selectedIds,
  selectedRows,
  activeOnly,
  onClearSelection,
  onScopeBulk
}: Props) {
  const qc = useQueryClient();
  const [feedback, setFeedback] = useState<string | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [termOpen, setTermOpen] = useState(false);
  const [customDate, setCustomDate] = useState("");
  const statusRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<HTMLDivElement>(null);

  const count = selectedIds.size;
  const ids = Array.from(selectedIds);

  useEffect(() => {
    if (count === 0) {
      setStatusOpen(false);
      setTermOpen(false);
      setFeedback(null);
    }
  }, [count]);

  const bulkMut = useMutation({
    mutationFn: async (patch: BulkPatch) => {
      const { data } = await api.patch<{ updated: number; failed: Array<{ id: number; error: string }> }>(
        `/api/${tenantSlug}/bonus-rules/bulk`,
        { rule_ids: ids, patch }
      );
      return data;
    },
    onSuccess: async (data) => {
      await qc.invalidateQueries({ queryKey: ["bonus-rules", tenantSlug] });
      const failNote =
        data.failed.length > 0
          ? ` · ошибок: ${data.failed.length} (заблокированные правила)`
          : "";
      setFeedback(`Обновлено: ${data.updated}${failNote}`);
      if (data.failed.length === 0) {
        onClearSelection();
      }
    },
    onError: (e) => {
      setFeedback(getUserFacingError(e, "Не удалось применить изменения"));
    }
  });

  if (count === 0) return null;

  const applyPatch = (patch: BulkPatch) => {
    setStatusOpen(false);
    setTermOpen(false);
    setFeedback(null);
    bulkMut.mutate(patch);
  };

  const applyCustomDate = () => {
    if (!customDate) return;
    const iso = new Date(`${customDate}T23:59:59`).toISOString();
    applyPatch({ valid_to: iso });
  };

  const barShell = (children: React.ReactNode) => (
    <div className="animate-expand flex max-w-[min(100vw-1rem,56rem)] flex-nowrap items-center gap-2 overflow-x-auto overflow-y-visible rounded-xl border border-border bg-card px-3 py-2 shadow-2xl [overflow-y:visible] scrollbar-none dark:border-border dark:bg-card">
      {children}
    </div>
  );

  const mainView = barShell(
    <>
      <div className="shrink-0 border-r border-border px-3 py-1.5 text-sm font-medium text-gray-700 dark:border-border dark:text-foreground">
        Выбрано:{" "}
        <span className="text-base font-bold text-teal-700 tabular-nums dark:text-teal-400">
          {formatGroupedInteger(count)}
        </span>
      </div>

      <div className="relative shrink-0" ref={statusRef}>
        <button
          type="button"
          disabled={bulkMut.isPending}
          onClick={() => setStatusOpen((v) => !v)}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-[#22c55e] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-600 disabled:opacity-60"
        >
          <Power className="size-4" aria-hidden />
          Статус
          <ChevronDown className={cn("size-3.5 transition-transform", statusOpen && "rotate-180")} aria-hidden />
        </button>
        <BulkToolbarDropdownPortal open={statusOpen} anchorRef={statusRef} onClose={() => setStatusOpen(false)}>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-emerald-700 hover:bg-muted"
            onClick={() => applyPatch({ is_active: true })}
          >
            Активировать
          </button>
          <button
            type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-700 hover:bg-muted"
            onClick={() => applyPatch({ is_active: false })}
          >
            Деактивировать
          </button>
        </BulkToolbarDropdownPortal>
      </div>

      <div className="relative shrink-0" ref={termRef}>
        <button
          type="button"
          disabled={bulkMut.isPending}
          onClick={() => setTermOpen((v) => !v)}
          className={toolbarBtn}
        >
          <CalendarClock className="size-4 shrink-0 text-gray-500" aria-hidden />
          Срок
          <ChevronDown className={cn("size-3.5 transition-transform", termOpen && "rotate-180")} aria-hidden />
        </button>
        <BulkToolbarDropdownPortal open={termOpen} anchorRef={termRef} onClose={() => setTermOpen(false)} minWidth={260}>
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={() => applyPatch({ extend_days: 7 })}
          >
            +7 дней
          </button>
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={() => applyPatch({ extend_days: 30 })}
          >
            +30 дней
          </button>
          <button
            type="button"
            className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
            onClick={() => applyPatch({ extend_days: 90 })}
          >
            +90 дней
          </button>
          <div className="my-1 border-t border-border" />
          <div className="space-y-2 px-3 py-2">
            <p className="text-xs text-muted-foreground">Действует до</p>
            <Input
              type="date"
              className="h-8 text-sm"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
            />
            <Button type="button" size="sm" className="w-full" disabled={!customDate} onClick={applyCustomDate}>
              Применить дату
            </Button>
          </div>
        </BulkToolbarDropdownPortal>
      </div>

      <button type="button" className={toolbarBtn} disabled={bulkMut.isPending} onClick={onScopeBulk}>
        <Link2 className="size-4 shrink-0 text-gray-500" aria-hidden />
        Привязка
      </button>

      <button
        type="button"
        className="ml-1 flex size-9 shrink-0 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-muted hover:text-gray-700 dark:hover:bg-muted"
        title="Закрыть"
        onClick={onClearSelection}
      >
        <X className="size-4" aria-hidden />
      </button>
    </>
  );

  const floatingBar = (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-5 z-[100] flex justify-center px-2 sm:px-3 md:pl-[var(--settings-aside-offset,0px)]"
      style={{ ["--settings-aside-offset" as string]: `${SETTINGS_ASIDE_PX}px` }}
    >
      <div className="pointer-events-auto flex w-full max-w-[min(100vw-1rem,90rem)] flex-col items-center gap-2">
        {feedback ? (
          <p className="max-w-lg rounded-lg border border-border bg-card px-3 py-1.5 text-center text-xs text-muted-foreground shadow-lg">
            {feedback}
          </p>
        ) : null}
        {selectedRows.some((r) => r.has_been_used) ? (
          <p className="max-w-lg rounded-lg border border-amber-200/80 bg-amber-50 px-3 py-1.5 text-center text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-200">
            Часть правил уже использовалась в заказах — доступны только срок, статус и привязка.
          </p>
        ) : null}
        {mainView}
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(floatingBar, document.body) : null;
}
