"use client";

import { ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, FileSpreadsheet, Loader2, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { DEFAULT_TABLE_PAGE_SIZES } from "@/lib/table-page-sizes";
import { cn } from "@/lib/utils";

/** White template card (gray border, soft shadow); colors come from `.payroll-template`. */
export const PAYROLL_CARD = "rounded-xl border border-[var(--pr-border)] bg-card shadow-[var(--pr-shadow)]";

/** Bordered square icon button (template `IconButton`). */
export const PAYROLL_ICON_BTN =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[var(--pr-input)] bg-card text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40";

/** Secondary button (template `Button variant="secondary"`). */
export const PAYROLL_SECONDARY_BTN =
  "inline-flex h-9 select-none items-center justify-center gap-2 rounded-lg border border-[var(--pr-input)] bg-card px-4 text-[13.5px] font-medium text-foreground/80 shadow-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60";

export function PayrollTableCard({
  title,
  titleAction,
  tabs,
  children,
  className
}: {
  title?: ReactNode;
  titleAction?: ReactNode;
  tabs?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn(PAYROLL_CARD, "overflow-hidden", className)}>
      {title || titleAction ? (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--pr-line)] px-4 py-4 sm:px-5">
          <h2 className="text-[17px] font-bold text-foreground">{title}</h2>
          {titleAction}
        </div>
      ) : null}
      {tabs ? <div className="flex flex-wrap items-end gap-1 border-b border-[var(--pr-line)] px-3 pt-2 sm:px-4">{tabs}</div> : null}
      {children}
    </section>
  );
}

export function PayrollTableToolbar({
  pageSize,
  onPageSize,
  onColumns,
  search,
  onSearch,
  searchPlaceholder = "Поиск",
  onRefresh,
  refreshing,
  onExport,
  exporting,
  leading,
  children
}: {
  pageSize?: number;
  onPageSize?: (n: number) => void;
  onColumns?: () => void;
  search?: string;
  onSearch?: (v: string) => void;
  searchPlaceholder?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
  onExport?: () => void;
  exporting?: boolean;
  leading?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="table-toolbar flex flex-wrap items-center gap-2 border-b border-[var(--pr-line)] px-3 py-3 sm:px-4">
      {leading}
      {pageSize != null && onPageSize ? (
        <div className="relative w-[76px]">
          <select
            aria-label="Строк на странице"
            className={cn(PAYROLL_INPUT, "cursor-pointer appearance-none pl-3 pr-7")}
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
          >
            {DEFAULT_TABLE_PAGE_SIZES.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        </div>
      ) : null}
      {onColumns ? (
        <button type="button" className={PAYROLL_ICON_BTN} title="Настроить столбцы" aria-label="Столбцы" onClick={onColumns}>
          <SlidersHorizontal className="h-4 w-4" />
        </button>
      ) : null}
      {onSearch ? (
        <div className="relative min-w-[160px] max-w-[300px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className={cn(PAYROLL_INPUT, "pl-9 pr-8")}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            value={search ?? ""}
            onChange={(e) => onSearch(e.target.value)}
          />
          {search ? (
            <button
              type="button"
              aria-label="Очистить"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              onClick={() => onSearch("")}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ) : null}
      {onRefresh ? (
        <button
          type="button"
          className={cn(PAYROLL_ICON_BTN, refreshing && "border-[var(--pr-brand-200)] bg-[var(--pr-brand-50)] text-[var(--pr-brand-600)]")}
          title="Обновить"
          aria-label="Обновить"
          disabled={refreshing}
          onClick={onRefresh}
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
        </button>
      ) : null}
      {onExport ? (
        <button type="button" className={PAYROLL_SECONDARY_BTN} disabled={exporting} onClick={onExport}>
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileSpreadsheet className="h-4 w-4 text-emerald-600" />}
          Excel
        </button>
      ) : null}
      {children ? <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

function pageNumbers(page: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const out: (number | "…")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(total - 1, page + 1);
  if (start > 2) out.push("…");
  for (let i = start; i <= end; i += 1) out.push(i);
  if (end < total - 1) out.push("…");
  out.push(total);
  return out;
}

export function PayrollPagination({
  page,
  pageSize,
  total,
  onPage,
  extra
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
  extra?: ReactNode;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="table-content-footer flex flex-wrap items-center justify-between gap-3 border-t border-[var(--pr-line)] px-3 py-3 text-[12.5px] text-muted-foreground sm:px-4">
      <span>
        Показано{" "}
        <span className="font-semibold tabular-nums text-[var(--pr-brand-600)]">
          {from} - {to}
        </span>{" "}
        / <span className="font-semibold tabular-nums text-[var(--pr-brand-600)]">{total}</span>
        {extra}
      </span>
      <nav className="flex items-center gap-1" aria-label="Пагинация">
        <button type="button" className={cn(PAYROLL_ICON_BTN, "h-8 w-8")} aria-label="Назад" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pageNumbers(page, pages).map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-1 text-[13px]">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPage(p)}
              aria-current={p === page ? "page" : undefined}
              className={cn(
                "h-8 min-w-8 rounded-md px-1 text-[13px] font-medium tabular-nums transition-colors",
                p === page ? "bg-[var(--pr-pine)] text-white shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {p}
            </button>
          )
        )}
        <button type="button" className={cn(PAYROLL_ICON_BTN, "h-8 w-8")} aria-label="Вперёд" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </button>
      </nav>
    </div>
  );
}

/** Client-side paging; page resets when `resetKey` changes and clamps when rows shrink. */
export function usePagedRows<T>(rows: T[], pageSize: number, resetKey?: unknown) {
  const [page, setPage] = useState(1);
  useEffect(() => setPage(1), [resetKey, pageSize]);
  const pages = Math.max(1, Math.ceil(rows.length / pageSize));
  const current = Math.min(page, pages);
  const pageRows = useMemo(() => rows.slice((current - 1) * pageSize, current * pageSize), [rows, current, pageSize]);
  return { page: current, setPage, pageRows, total: rows.length };
}

export type SortState<K extends string> = { key: K; dir: "asc" | "desc" } | null;

export function useSortedRows<T, K extends string>(rows: T[], get: (row: T, key: K) => string | number | null | undefined) {
  const [sort, setSort] = useState<SortState<K>>(null);
  const sorted = useMemo(() => {
    if (!sort) return rows;
    const mul = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = get(a, sort.key);
      const bv = get(b, sort.key);
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * mul;
      return String(av ?? "").localeCompare(String(bv ?? ""), "ru") * mul;
    });
  }, [rows, sort, get]);
  const toggle = (key: K) =>
    setSort((s) => (s?.key !== key ? { key, dir: "asc" } : s.dir === "asc" ? { key, dir: "desc" } : null));
  return { sorted, sort, toggle };
}

export function SortTh<K extends string>({
  label,
  sortKey,
  sort,
  onSort,
  className
}: {
  label: ReactNode;
  sortKey: K;
  sort: SortState<K>;
  onSort: (k: K) => void;
  className?: string;
}) {
  const active = sort?.key === sortKey;
  return (
    <th className={cn(PAYROLL_TH, className)}>
      <button type="button" className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground")} onClick={() => onSort(sortKey)}>
        {label}
        <ChevronsUpDown className={cn("h-3.5 w-3.5 opacity-40", active && "text-[var(--pr-brand-600)] opacity-100")} />
      </button>
    </th>
  );
}

/** Template input (h-9, gray border, soft shadow). */
export const PAYROLL_INPUT =
  "h-9 w-full rounded-lg border border-[var(--pr-input)] bg-card text-[13px] text-foreground shadow-sm outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-[var(--pr-brand-100)]";

/** Template table look shared by every payroll list. */
export const PAYROLL_TABLE = "w-full border-collapse text-left text-[13px]";
export const PAYROLL_THEAD = "bg-[var(--pr-head)]";
export const PAYROLL_TH = "whitespace-nowrap px-4 py-2.5 text-left text-[12.5px] font-semibold text-muted-foreground";
export const PAYROLL_TD = "px-4 py-3 align-top";
export const PAYROLL_TR = "border-t border-[var(--pr-line)] transition-colors duration-100 hover:bg-[var(--pr-row-hover)]";

const ACTION_TONE = {
  edit: "text-amber-500 hover:border-amber-200 hover:bg-amber-50 hover:text-amber-600",
  danger: "text-rose-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700",
  success: "text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700",
  neutral: "text-muted-foreground hover:bg-muted hover:text-foreground"
} as const;

/** Square bordered row action button (template «Изменить» style). */
export function PayrollIconAction({
  label,
  tone = "neutral",
  disabled,
  onClick,
  children
}: {
  label: string;
  tone?: keyof typeof ACTION_TONE;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-lg border border-[var(--pr-border)] bg-card shadow-sm transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-3.5",
        ACTION_TONE[tone]
      )}
    >
      {children}
    </button>
  );
}

/** Thin strip under the toolbar shown while rows are selected. */
export function PayrollSelectionBar({ count, extra, onClear, children }: { count: number; extra?: ReactNode; onClear: () => void; children?: ReactNode }) {
  if (!count) return null;
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[var(--pr-brand-100)] bg-[var(--pr-brand-50)] px-3 py-2 text-[13px] sm:px-4">
      <span className="font-medium">
        Выбрано: {count}
        {extra}
      </span>
      {children}
      <Button size="sm" variant="ghost" onClick={onClear}>
        Снять выбор
      </Button>
    </div>
  );
}

export function PayrollEmptyRow({ colSpan, loading, text = "Нет данных" }: { colSpan: number; loading?: boolean; text?: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="border-t border-[var(--pr-line)] px-4 py-14 text-center text-[13px] text-muted-foreground">
        {loading ? "Загрузка…" : text}
      </td>
    </tr>
  );
}
