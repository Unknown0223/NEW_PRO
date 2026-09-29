"use client";

import { ChevronLeft, ChevronRight, ChevronsUpDown, FileSpreadsheet, RefreshCw, Search, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DEFAULT_TABLE_PAGE_SIZES } from "@/lib/table-page-sizes";
import { cn } from "@/lib/utils";

/** Table section card (system `orders-hub-section--table`) with an optional title row. */
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
    <div className={cn("orders-hub-section orders-hub-section--table", className)}>
      <div className="overflow-hidden">
        {title || titleAction ? (
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 px-4 py-3">
            <h2 className="text-base font-bold text-foreground">{title}</h2>
            {titleAction}
          </div>
        ) : null}
        {tabs ? <div className="flex flex-wrap items-end gap-1 border-b border-border/80 bg-muted/25 px-3 pt-2 sm:px-4">{tabs}</div> : null}
        {children}
      </div>
    </div>
  );
}

/** Underline tab used in table card header rows (system standard). */
export function PayrollCardTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "-mb-px inline-flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
        active ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
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
    <div className="table-toolbar flex flex-wrap items-center gap-2 border-b border-border/80 bg-muted/30 px-3 py-2 sm:px-4">
      {leading}
      {pageSize != null && onPageSize ? (
        <select
          aria-label="Строк на странице"
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          value={pageSize}
          onChange={(e) => onPageSize(Number(e.target.value))}
        >
          {DEFAULT_TABLE_PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      ) : null}
      {onColumns ? (
        <Button type="button" variant="outline" size="icon" className="h-9 w-9" title="Столбцы" aria-label="Столбцы" onClick={onColumns}>
          <SlidersHorizontal className="h-4 w-4" />
        </Button>
      ) : null}
      {onSearch ? (
        <div className="relative min-w-[200px] max-w-[320px] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="h-9 pl-8 pr-8" placeholder={searchPlaceholder} value={search ?? ""} onChange={(e) => onSearch(e.target.value)} />
          {search ? (
            <button
              type="button"
              aria-label="Очистить"
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => onSearch("")}
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ) : null}
      {onRefresh ? (
        <Button type="button" variant="outline" size="icon" className="h-9 w-9" title="Обновить" aria-label="Обновить" disabled={refreshing} onClick={onRefresh}>
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
        </Button>
      ) : null}
      {onExport ? (
        <Button
          type="button"
          variant="outline"
          className="h-9 gap-1.5 border-green-600/40 text-green-700 hover:bg-green-50 dark:text-green-400"
          disabled={exporting}
          onClick={onExport}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Excel
        </Button>
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
    <div className="table-content-footer flex flex-wrap items-center justify-between gap-3 border-t border-border/80 bg-muted/25 px-3 py-3 text-xs text-muted-foreground sm:px-4">
      <span>
        Показано <b className="text-foreground">{from}</b> - <b className="text-foreground">{to}</b> / <b className="text-foreground">{total}</b>
        {extra}
      </span>
      <div className="flex items-center gap-1">
        <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label="Назад" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {pageNumbers(page, pages).map((p, i) =>
          p === "…" ? (
            <span key={`gap-${i}`} className="px-1">
              …
            </span>
          ) : (
            <button
              key={p}
              type="button"
              onClick={() => onPage(p)}
              className={cn(
                "h-8 min-w-8 rounded-md px-2 text-xs font-semibold tabular-nums transition-colors",
                p === page ? "bg-[#063b36] text-white" : "border border-border bg-background text-foreground hover:bg-muted"
              )}
            >
              {p}
            </button>
          )
        )}
        <Button type="button" variant="outline" size="icon" className="h-8 w-8" aria-label="Вперёд" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
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
    <th className={cn("px-3 py-2.5 text-left font-medium", className)}>
      <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => onSort(sortKey)}>
        {label}
        <ChevronsUpDown className={cn("h-3.5 w-3.5 opacity-50", active && "text-primary opacity-100")} />
      </button>
    </th>
  );
}

/** Filter section for system-standard (non-template) pages. */
export function PayrollFiltersSection({ children }: { children: ReactNode }) {
  return (
    <div className="orders-hub-section orders-hub-section--filters orders-hub-section--stack-tight">
      <div className="flex flex-wrap items-end gap-3 p-4 sm:p-5">{children}</div>
    </div>
  );
}

export function PayrollFilterField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={cn("orders-filter-field-label", className)}>
      {label}
      {children}
    </label>
  );
}

export const PAYROLL_FILTER_CONTROL = "h-10 rounded-lg";

export function PayrollEmptyRow({ colSpan, loading, text = "Нет данных" }: { colSpan: number; loading?: boolean; text?: string }) {
  return (
    <tr>
      <td colSpan={colSpan} className="px-4 py-12 text-center text-sm text-muted-foreground">
        {loading ? "Загрузка…" : text}
      </td>
    </tr>
  );
}
