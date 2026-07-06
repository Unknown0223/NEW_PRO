"use client";

import {
  ArrowDownUp,
  Calendar,
  ChevronDown,
  Columns3,
  FileSpreadsheet,
  Filter,
  RefreshCw,
  Search
} from "lucide-react";
import type { BalanceDetailSortDir, BalanceDetailSortField } from "@/lib/client-balance-detail/types";

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  perPage: number;
  onPerPageChange: (n: number) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  showSystemOps: boolean;
  onShowSystemOpsChange: (v: boolean) => void;
  sortField: BalanceDetailSortField;
  sortDir: BalanceDetailSortDir;
  onSortFieldChange: (f: BalanceDetailSortField) => void;
  onSortDirToggle: () => void;
  onColumnsClick: () => void;
  onFiltersClick: () => void;
  filtersOpen: boolean;
  onRefresh: () => void;
  onExport: () => void;
  refreshing?: boolean;
  exportBusy?: boolean;
  canExport?: boolean;
};

export function BalanceDetailToolbar({
  search,
  onSearchChange,
  perPage,
  onPerPageChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  showSystemOps,
  onShowSystemOpsChange,
  sortField,
  sortDir,
  onSortFieldChange,
  onSortDirToggle,
  onColumnsClick,
  onFiltersClick,
  filtersOpen,
  onRefresh,
  onExport,
  refreshing,
  exportBusy,
  canExport
}: Props) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-[#e5e7eb] bg-white px-3 py-2">
      <button
        type="button"
        onClick={onSortDirToggle}
        className="flex h-8 items-center gap-1 rounded border border-[#d0d5dd] bg-white px-2 text-[12px] text-[#555] hover:bg-[#f9fafb]"
        title="Направление сортировки"
      >
        <ArrowDownUp className="h-3.5 w-3.5" />
        {sortDir === "asc" ? "↑" : "↓"}
      </button>
      <select
        value={sortField}
        onChange={(e) => onSortFieldChange(e.target.value as BalanceDetailSortField)}
        className="h-8 rounded border border-[#d0d5dd] bg-white px-2 text-[12px] text-[#333]"
      >
        <option value="createdAt">По дате</option>
        <option value="debt">По долгу</option>
        <option value="payment">По оплате</option>
        <option value="docNumber">По документу</option>
      </select>
      <button
        type="button"
        onClick={onColumnsClick}
        className="flex h-8 items-center gap-1 rounded border border-[#d0d5dd] bg-white px-2 text-[12px] text-[#555] hover:bg-[#f9fafb]"
      >
        <Columns3 className="h-3.5 w-3.5" />
        Колонки
      </button>
      <button
        type="button"
        onClick={onFiltersClick}
        className={`flex h-8 items-center gap-1 rounded border px-2 text-[12px] hover:bg-[#f9fafb] ${
          filtersOpen ? "border-[#1aa096] bg-[#e6f7f5] text-[#1aa096]" : "border-[#d0d5dd] bg-white text-[#555]"
        }`}
      >
        <Filter className="h-3.5 w-3.5" />
        Фильтры
      </button>
      <select
        value={perPage}
        onChange={(e) => onPerPageChange(Number(e.target.value))}
        className="h-8 rounded border border-[#d0d5dd] bg-white px-2 text-[12px]"
      >
        <option value={10}>10</option>
        <option value={30}>30</option>
        <option value={50}>50</option>
      </select>
      <div className="relative min-w-[140px] flex-1">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#999]" />
        <input
          type="text"
          placeholder="Поиск"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8 w-full rounded border border-[#d0d5dd] bg-white pl-7 pr-2 text-[12px] outline-none focus:border-[#1aa096]"
        />
      </div>
      <button
        type="button"
        onClick={onExport}
        disabled={exportBusy || !canExport}
        className="flex h-8 items-center gap-1 rounded border border-[#d0d5dd] bg-white px-2 text-[12px] text-[#555] hover:bg-[#f9fafb] disabled:opacity-50"
      >
        <FileSpreadsheet className="h-3.5 w-3.5" />
        {exportBusy ? "…" : "Excel"}
      </button>
      <button
        type="button"
        onClick={onRefresh}
        className="flex h-8 items-center gap-1 rounded border border-[#d0d5dd] bg-white px-2 text-[12px] text-[#555] hover:bg-[#f9fafb]"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin-slow" : ""}`} />
        Обновить
      </button>
      <div className="flex items-center gap-1">
        <Calendar className="h-3.5 w-3.5 text-[#999]" />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="h-8 rounded border border-[#d0d5dd] px-2 text-[12px]"
        />
        <span className="text-[#999]">—</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="h-8 rounded border border-[#d0d5dd] px-2 text-[12px]"
        />
      </div>
      <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-[#555]">
        <input
          type="checkbox"
          checked={showSystemOps}
          onChange={(e) => onShowSystemOpsChange(e.target.checked)}
          className="rounded border-[#d0d5dd]"
        />
        Системные операции
      </label>
      <ChevronDown className="hidden h-3.5 w-3.5 text-[#999]" />
    </div>
  );
}
