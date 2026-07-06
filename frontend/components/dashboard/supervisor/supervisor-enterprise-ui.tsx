"use client";

import type { ReactNode } from "react";
import { FileSpreadsheet, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const enterpriseSelectClass =
  "h-10 rounded-xl border border-border bg-muted/50 px-3 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-border dark:bg-muted/50";

export const enterpriseInputClass =
  "h-10 rounded-xl border border-border bg-muted/50 pl-10 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-border dark:bg-muted/50";

export function SupervisorEnterpriseSegmentTabs({
  tabs,
  value,
  onChange,
  className
}: {
  tabs: Array<{ key: string; label: string }>;
  value: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap gap-1 rounded-xl bg-muted p-1 dark:bg-muted", className)}>
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onChange(t.key)}
          className={cn(
            "rounded-lg px-4 py-2 text-sm font-medium transition-all",
            value === t.key
              ? "bg-card text-teal-700 shadow-sm dark:bg-card dark:text-teal-300"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function SupervisorEnterpriseToolbar({
  pageSize,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 30, 50, 100],
  search,
  onSearchChange,
  searchPlaceholder = "Поиск...",
  onExcel,
  onRefresh,
  refreshing,
  totalCount,
  children
}: {
  pageSize?: number;
  onPageSizeChange?: (n: number) => void;
  pageSizeOptions?: number[];
  search?: string;
  onSearchChange?: (v: string) => void;
  searchPlaceholder?: string;
  onExcel?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  totalCount?: number;
  children?: ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex flex-wrap items-center gap-3">
        {pageSize != null && onPageSizeChange ? (
          <select
            className={enterpriseSelectClass}
            value={String(pageSize)}
            onChange={(e) => onPageSizeChange(Number.parseInt(e.target.value, 10) || pageSize)}
            aria-label="Строк на странице"
          >
            {pageSizeOptions.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        ) : null}
        {onSearchChange != null && search != null ? (
          <div className="relative min-w-0 max-w-xs flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={searchPlaceholder}
              value={search}
              onChange={(e) => onSearchChange(e.target.value)}
              className={enterpriseInputClass}
            />
          </div>
        ) : null}
        {children}
        {onExcel ? (
          <button
            type="button"
            onClick={onExcel}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-4 text-sm font-medium hover:bg-muted dark:border-border"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" aria-hidden />
            Excel
          </button>
        ) : null}
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-border hover:bg-muted disabled:opacity-50 dark:border-border"
            aria-label="Обновить"
          >
            <Loader2 className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </button>
        ) : null}
      </div>
      {totalCount != null ? (
        <span className="text-sm text-muted-foreground">Всего: {totalCount}</span>
      ) : null}
    </div>
  );
}

export function SupervisorEnterpriseTableWrap({
  children,
  className
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto rounded-xl border border-border dark:border-border", className)}>
      {children}
    </div>
  );
}

export function SupervisorEnterprisePager({
  page,
  totalPages,
  totalRows,
  pageSize,
  onPage
}: {
  page: number;
  totalPages: number;
  totalRows: number;
  pageSize: number;
  onPage: (next: number) => void;
}) {
  if (totalPages <= 1) return null;
  const safeSize = Math.max(1, pageSize);
  const from = totalRows === 0 ? 0 : (page - 1) * safeSize + 1;
  const to = totalRows === 0 ? 0 : Math.min(page * safeSize, totalRows);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <span>
        Показано {from} – {to} / {totalRows}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="h-9 rounded-xl border border-border bg-card px-3 text-sm hover:bg-muted disabled:opacity-50 dark:border-border dark:bg-card"
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Назад
        </button>
        <span className="tabular-nums">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          className="h-9 rounded-xl border border-border bg-card px-3 text-sm hover:bg-muted disabled:opacity-50 dark:border-border dark:bg-card"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Вперёд
        </button>
      </div>
    </div>
  );
}
