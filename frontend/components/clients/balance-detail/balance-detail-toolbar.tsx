"use client";

import {
  DateRangePopover,
  formatDateRangeButton,
  localYmd
} from "@/components/ui/date-range-popover";
import {
  ArrowDownUp,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  FileSpreadsheet,
  RefreshCw,
  Search
} from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
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
  onRefresh: () => void;
  onExport: () => void;
  refreshing?: boolean;
  exportBusy?: boolean;
  canExport?: boolean;
  /** Excel tugmasi ko'rinadimi (ruxsat). */
  showExport?: boolean;
  actions?: ReactNode;
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
  onRefresh,
  onExport,
  refreshing,
  exportBusy,
  canExport,
  showExport = true,
  actions
}: Props) {
  const rangeAnchorRef = useRef<HTMLButtonElement>(null);
  const [rangeOpen, setRangeOpen] = useState(false);
  const rangeLabel =
    dateFrom.trim() || dateTo.trim() ? formatDateRangeButton(dateFrom, dateTo) : "Дата";

  const shiftRange = (deltaDays: number) => {
    const parse = (s: string) => {
      const t = s.trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
      const [y, m, d] = t.split("-").map(Number);
      const dt = new Date(y, m - 1, d);
      return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d ? dt : null;
    };
    let a = parse(dateFrom);
    let b = parse(dateTo);
    if (!a || !b) {
      const now = new Date();
      a = new Date(now.getFullYear(), now.getMonth(), now.getDate() + deltaDays);
      b = new Date(a);
    } else {
      a = new Date(a.getFullYear(), a.getMonth(), a.getDate() + deltaDays);
      b = new Date(b.getFullYear(), b.getMonth(), b.getDate() + deltaDays);
    }
    onDateFromChange(localYmd(a));
    onDateToChange(localYmd(b));
  };

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
      {showExport ? (
        <button
          type="button"
          onClick={onExport}
          disabled={exportBusy || !canExport}
          className="flex h-8 items-center gap-1 rounded border border-[#d0d5dd] bg-white px-2 text-[12px] text-[#555] hover:bg-[#f9fafb] disabled:opacity-50"
        >
          <FileSpreadsheet className="h-3.5 w-3.5" />
          {exportBusy ? "…" : "Excel"}
        </button>
      ) : null}
      <button
        type="button"
        onClick={onRefresh}
        className="flex h-8 items-center gap-1 rounded border border-[#d0d5dd] bg-white px-2 text-[12px] text-[#555] hover:bg-[#f9fafb]"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin-slow" : ""}`} />
        Обновить
      </button>
      <div className="flex h-8 shrink-0 items-center overflow-hidden rounded border border-[#d0d5dd] bg-white">
        <button
          type="button"
          className="grid h-8 w-7 place-items-center border-r border-[#d0d5dd] hover:bg-[#f9fafb]"
          aria-label="Предыдущий день"
          onClick={() => shiftRange(-1)}
        >
          <ChevronLeft className="h-3.5 w-3.5 text-[#667085]" />
        </button>
        <button
          ref={rangeAnchorRef}
          type="button"
          className="flex h-8 min-w-[9.5rem] items-center justify-center gap-1.5 px-2 text-[12px] font-medium tabular-nums text-[#333] hover:bg-[#f9fafb]"
          onClick={() => setRangeOpen((v) => !v)}
        >
          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-[#0f6e68]" aria-hidden />
          <span className="truncate">{rangeLabel}</span>
        </button>
        <button
          type="button"
          className="grid h-8 w-7 place-items-center border-l border-[#d0d5dd] hover:bg-[#f9fafb]"
          aria-label="Следующий день"
          onClick={() => shiftRange(1)}
        >
          <ChevronRight className="h-3.5 w-3.5 text-[#667085]" />
        </button>
      </div>
      <DateRangePopover
        open={rangeOpen}
        onOpenChange={setRangeOpen}
        anchorRef={rangeAnchorRef}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onApply={(next) => {
          onDateFromChange(next.dateFrom);
          onDateToChange(next.dateTo);
        }}
      />
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
      {actions ? <div className="ml-auto flex shrink-0 items-center">{actions}</div> : null}
    </div>
  );
}
