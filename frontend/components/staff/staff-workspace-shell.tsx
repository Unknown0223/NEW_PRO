"use client";

import type { ReactNode } from "react";
import {
  FileSpreadsheet,
  Filter,
  ListOrdered,
  Plus,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Upload
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AgentFilterSelect, AgentTabButton } from "@/components/staff/agent-workspace-template-ui";
import { TableSearchField } from "@/components/ui/table-search-field";
import { DEFAULT_TABLE_PAGE_SIZES } from "@/lib/table-page-sizes";

export type StaffListTab = "active" | "inactive";

export function StaffWorkspaceLayout({ children }: { children: ReactNode }) {
  return <div className="space-y-4">{children}</div>;
}

export function StaffWorkspaceHeader({
  title,
  subtitle,
  addLabel,
  onAdd,
  onColumnSettings,
  extraActions,
  canAdd = true
}: {
  title: string;
  subtitle: string;
  addLabel: string;
  onAdd: () => void;
  onColumnSettings?: () => void;
  /** Qatorning o‘ng tomonida (ko‘rinish, eksport va h.k.) */
  extraActions?: ReactNode;
  /** false bo‘lsa «Добавить» yashirinadi */
  canAdd?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-card p-5 shadow-sm ring-1 ring-slate-200">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
        <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canAdd ? (
          <button
            type="button"
            onClick={onAdd}
            className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700"
          >
            <Plus className="h-4 w-4" />
            {addLabel}
          </button>
        ) : null}
        {extraActions}
        {onColumnSettings ? (
          <button
            type="button"
            title="Управление столбцами"
            onClick={onColumnSettings}
            className="grid h-10 w-10 place-items-center rounded-lg bg-muted text-slate-600 hover:bg-muted"
          >
            <SlidersHorizontal className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

export function StaffWorkspaceFilterPanel({
  filters,
  onReset,
  onApply,
  tab,
  onTabChange,
  pageSize,
  onPageSizeChange,
  allOnPageSelected,
  onToggleAllOnPage,
  onColumnSettings,
  onSearch,
  searchPlaceholder = "Поиск…",
  onExport,
  onImport,
  onRefresh,
  isFetching,
  bulkMenu,
  filtersLayout = "default"
}: {
  filters: ReactNode;
  onReset: () => void;
  onApply: () => void;
  tab: StaffListTab;
  onTabChange: (tab: StaffListTab) => void;
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  allOnPageSelected: boolean;
  onToggleAllOnPage: (checked: boolean) => void;
  onColumnSettings: () => void;
  onSearch: (value: string) => void;
  searchPlaceholder?: string;
  onExport?: () => void;
  /** Открыть диалог импорта Excel */
  onImport?: () => void;
  onRefresh: () => void;
  isFetching?: boolean;
  bulkMenu?: ReactNode;
  /** Klientlar sahifasi kabi bitta qator grid; stacked — filtrlar ustida, tugmalar pastda; filters-only — faqat filtr sloti */
  filtersLayout?: "default" | "clients-row" | "stacked" | "filters-only";
}) {
  const panelClass =
    filtersLayout === "clients-row"
      ? "w-full rounded-lg border border-border bg-card px-4 pb-3 pt-4 shadow-sm sm:px-6"
      : "rounded-2xl bg-card p-4 shadow-sm ring-1 ring-slate-200";

  const filterActionsClientsRow = (
    <div className="col-span-2 flex min-w-[9.5rem] items-center gap-2 sm:col-span-1 xl:col-span-2">
      <button
        type="button"
        title="Сбросить"
        onClick={onReset}
        className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-lg border border-border bg-card transition-colors hover:bg-muted"
      >
        <RotateCcw className="h-4 w-4 text-gray-600" />
      </button>
      <button
        type="button"
        onClick={onApply}
        className="h-[38px] flex-1 whitespace-nowrap rounded-lg bg-emerald-500 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-600"
      >
        Применить
      </button>
    </div>
  );

  const filterActionsDefault = (
    <div className="ml-auto flex items-center gap-2">
      <button
        type="button"
        onClick={onReset}
        className="flex items-center gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-slate-600 hover:bg-muted"
      >
        <Filter className="h-4 w-4" /> Сбросить
      </button>
      <button
        type="button"
        onClick={onApply}
        className="flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
      >
        Применить
      </button>
    </div>
  );

  return (
    <div className={panelClass}>
      {filtersLayout === "clients-row" ? (
        <div className="grid grid-cols-2 items-end gap-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7">
          {filters}
          {filterActionsClientsRow}
        </div>
      ) : filtersLayout === "filters-only" ? (
        <div>{filters}</div>
      ) : filtersLayout === "stacked" ? (
        <div className="space-y-2">
          {filters}
          <div className="flex justify-end border-t border-border/60 pt-2">{filterActionsDefault}</div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {filters}
          {filterActionsDefault}
        </div>
      )}

      <div className="mt-4 flex items-center gap-1 border-b border-border">
        <AgentTabButton active={tab === "active"} onClick={() => onTabChange("active")}>
          Активный
        </AgentTabButton>
        <AgentTabButton active={tab === "inactive"} onClick={() => onTabChange("inactive")}>
          Не активный
        </AgentTabButton>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-slate-700 hover:bg-muted">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-border accent-primary"
            checked={allOnPageSelected}
            onChange={(e) => onToggleAllOnPage(e.target.checked)}
            aria-label="Выбрать всех на странице"
          />
          <span className="whitespace-nowrap text-xs sm:text-sm">Выбрать все на странице</span>
        </label>
        <button
          type="button"
          title="Управление столбцами"
          onClick={onColumnSettings}
          className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-slate-700 hover:bg-muted"
        >
          <ListOrdered className="h-4 w-4" />
        </button>
        <select
          className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-slate-700"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number.parseInt(e.target.value, 10))}
        >
          {DEFAULT_TABLE_PAGE_SIZES.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <TableSearchField onSearch={onSearch} placeholder={searchPlaceholder} />
        {onExport ? (
          <button
            type="button"
            onClick={onExport}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-slate-700 hover:bg-muted"
          >
            <FileSpreadsheet className="h-4 w-4" /> Excel
          </button>
        ) : null}
        {onImport ? (
          <button
            type="button"
            onClick={onImport}
            className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-slate-700 hover:bg-muted"
            title="Импорт Excel"
          >
            <Upload className="h-4 w-4" /> Импорт Excel
          </button>
        ) : null}
        <button
          type="button"
          onClick={onRefresh}
          className="grid h-9 w-9 place-items-center rounded-lg border border-border text-slate-700 hover:bg-muted"
        >
          <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
        </button>
        {bulkMenu ? <div className="relative ml-auto">{bulkMenu}</div> : null}
      </div>
    </div>
  );
}

/** Qulay filter: AgentFilterSelect o‘rniga children bilan optionlar */
/** Agent sahifasidagi «Групповая обработка» tugmasi — barcha KOMANDA ro‘llari uchun bir xil ko‘rinish. */
export function StaffBulkActionButton({
  disabled,
  onClick,
  label = "Групповая обработка"
}: {
  disabled?: boolean;
  onClick?: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
    >
      <SlidersHorizontal className="h-4 w-4" /> {label}
    </button>
  );
}

export function StaffFilterSelect({
  label,
  value,
  onChange,
  emptyLabel,
  children
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  emptyLabel: string;
  children: ReactNode;
}) {
  return (
    <AgentFilterSelect label={label} value={value} onChange={onChange} emptyLabel={emptyLabel}>
      {children}
    </AgentFilterSelect>
  );
}

export function StaffWorkspaceTable({
  columnOrder,
  columnLabelById,
  pageRows,
  filteredTotal,
  entityLabel,
  page,
  totalPages,
  onPageChange,
  isLoading,
  renderCell,
  renderActions,
  selectedIds,
  onToggleSelection,
  onToggleAllOnPage,
  rowKey = (id: number) => id,
  filterVisible
}: {
  columnOrder: readonly string[];
  columnLabelById: Map<string, string>;
  pageRows: Array<{ id: number }>;
  filteredTotal: number;
  entityLabel: string;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  renderCell: (colId: string, row: { id: number }) => ReactNode;
  renderActions: (row: { id: number }) => ReactNode;
  selectedIds: Set<number>;
  onToggleSelection: (id: number, checked: boolean) => void;
  /** Jadval headeridagi «hammasini belgilash» */
  onToggleAllOnPage?: (checked: boolean) => void;
  rowKey?: (id: number) => number | string;
  /** Вкладка «Не активный»: колонка «Фильтр» и группы. */
  filterVisible?: {
    checked: (id: number) => boolean;
    onToggle: (ids: number[], next: boolean) => void;
    busy?: boolean;
    groupLabel: (id: number) => string;
  };
}) {
  const paginationPages = (() => {
    const pages: number[] = [];
    const start = Math.max(1, page - 2);
    const end = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  })();

  const allOnPageSelected =
    pageRows.length > 0 && pageRows.every((r) => selectedIds.has(r.id));
  const someOnPageSelected = pageRows.some((r) => selectedIds.has(r.id));

  return (
    <div className="overflow-hidden rounded-2xl bg-card shadow-sm ring-1 ring-slate-200">
      <div className="scrollbar-none overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="w-10 px-3 py-3">
                {onToggleAllOnPage ? (
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border accent-primary"
                    checked={allOnPageSelected}
                    ref={(el) => {
                      if (el) el.indeterminate = someOnPageSelected && !allOnPageSelected;
                    }}
                    onChange={(e) => onToggleAllOnPage(e.target.checked)}
                    aria-label="Выбрать все на странице"
                    title="Выбрать все на странице"
                  />
                ) : null}
              </th>
              {filterVisible ? (
                <th className="px-3 py-3 text-left font-medium text-red-600">Фильтр</th>
              ) : null}
              {columnOrder.map((colId) => (
                <th key={colId} className="px-3 py-3 text-left font-medium">
                  {columnLabelById.get(colId) ?? colId}
                </th>
              ))}
              <th className="px-3 py-3 text-right font-medium" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {(() => {
              const groups: Array<{ label: string; rows: typeof pageRows }> = [];
              if (filterVisible) {
                const byLabel = new Map<string, typeof pageRows>();
                for (const r of pageRows) {
                  const label = filterVisible.groupLabel(r.id) || "Без группы";
                  const arr = byLabel.get(label) ?? [];
                  arr.push(r);
                  byLabel.set(label, arr);
                }
                for (const [label, rows] of byLabel) groups.push({ label, rows });
              }
              const bodyRows = filterVisible ? groups.flatMap((g) => g.rows) : pageRows;
              const colSpan = columnOrder.length + 2 + (filterVisible ? 1 : 0);
              const nodes: ReactNode[] = [];
              const pushRow = (r: (typeof pageRows)[number]) => {
                nodes.push(
                  <tr key={rowKey(r.id)} className="hover:bg-muted/60">
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-border"
                        checked={selectedIds.has(r.id)}
                        onChange={(e) => onToggleSelection(r.id, e.target.checked)}
                      />
                    </td>
                    {filterVisible ? (
                      <td className="px-3 py-3">
                        <FilterVisibleSwitch
                          checked={filterVisible.checked(r.id)}
                          disabled={filterVisible.busy}
                          onChange={(next) => filterVisible.onToggle([r.id], next)}
                        />
                      </td>
                    ) : null}
                    {columnOrder.map((colId) => (
                      <td key={colId} className="px-3 py-3">
                        {renderCell(colId, r)}
                      </td>
                    ))}
                    <td className="px-3 py-3">{renderActions(r)}</td>
                  </tr>
                );
              };
              if (filterVisible) {
                for (const g of groups) {
                  const ids = g.rows.map((r) => r.id);
                  const allOn = ids.every((id) => filterVisible.checked(id));
                  nodes.push(
                    <tr key={`g:${g.label}`} className="bg-red-50/70">
                      <td colSpan={colSpan} className="px-3 py-2">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-xs font-semibold uppercase tracking-wide text-red-700">
                            {g.label}
                            <span className="ml-2 font-normal normal-case text-red-600/80">{ids.length}</span>
                          </span>
                          <FilterVisibleSwitch
                            checked={allOn}
                            disabled={filterVisible.busy}
                            onChange={(next) => filterVisible.onToggle(ids, next)}
                          />
                        </div>
                      </td>
                    </tr>
                  );
                  for (const r of g.rows) pushRow(r);
                }
              } else {
                for (const r of bodyRows) pushRow(r);
              }
              if (pageRows.length === 0) {
                nodes.push(
                  <tr key="empty">
                    <td colSpan={colSpan} className="px-3 py-16 text-center text-sm text-slate-500">
                      {isLoading ? "Загрузка…" : "Нет данных по выбранным фильтрам"}
                    </td>
                  </tr>
                );
              }
              return nodes;
            })()}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/50 px-4 py-3 text-xs text-slate-600">
        <div>
          Показано <span className="font-semibold text-slate-900">{pageRows.length}</span> из{" "}
          <span className="font-semibold text-slate-900">{filteredTotal}</span> {entityLabel}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => onPageChange(Math.max(1, page - 1))}
            className="rounded-md border border-border bg-card px-2.5 py-1 hover:bg-muted disabled:opacity-50"
          >
            ←
          </button>
          {paginationPages.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={cn(
                "rounded-md border px-2.5 py-1",
                p === page
                  ? "border-teal-600 bg-teal-600 font-medium text-white"
                  : "border-border bg-card hover:bg-muted"
              )}
            >
              {p}
            </button>
          ))}
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            className="rounded-md border border-border bg-card px-2.5 py-1 hover:bg-muted disabled:opacity-50"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}

function FilterVisibleSwitch({
  checked,
  disabled,
  onChange
}: {
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="inline-flex cursor-pointer items-center">
      <input
        type="checkbox"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(!checked)}
      />
      <div
        className={cn(
          "relative h-5 w-9 rounded-full transition",
          checked ? "bg-red-500" : "bg-slate-300",
          disabled && "opacity-60"
        )}
      >
        <div
          className={cn(
            "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all",
            checked ? "left-[18px]" : "left-0.5"
          )}
        />
      </div>
      <span className={cn("ml-2 text-xs", checked ? "font-medium text-red-600" : "text-slate-500")}>
        {checked ? "Вкл" : "Выкл"}
      </span>
    </label>
  );
}
