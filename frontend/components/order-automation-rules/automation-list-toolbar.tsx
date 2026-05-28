"use client";

import { FileSpreadsheet, RefreshCw, Search, SlidersHorizontal, ArrowUpDown } from "lucide-react";

export function AutomationStatusTabs({
  status,
  onChange
}: {
  status: "active" | "inactive";
  onChange: (s: "active" | "inactive") => void;
}) {
  return (
    <div className="bg-white px-4 pt-3 pb-0">
      <div className="flex items-center gap-4 border-b border-gray-200">
        {(["active", "inactive"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onChange(s)}
            className={`relative pb-2 text-sm font-medium transition-colors ${
              status === s ? "text-teal-600" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {s === "active" ? "Активный" : "Не активный"}
            {status === s ? (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t bg-teal-600" />
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AutomationListToolbar({
  search,
  onSearchChange,
  itemsPerPage,
  onItemsPerPageChange,
  onRefresh,
  onExport
}: {
  search: string;
  onSearchChange: (v: string) => void;
  itemsPerPage: number;
  onItemsPerPageChange: (n: number) => void;
  onRefresh: () => void;
  onExport: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-b border-gray-200 bg-white px-4 py-2">
      <button
        type="button"
        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        title="Настройки колонок"
      >
        <SlidersHorizontal size={16} />
      </button>
      <button
        type="button"
        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
        title="Сортировка"
      >
        <ArrowUpDown size={16} />
      </button>
      <select
        value={itemsPerPage}
        onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
        className="cursor-pointer rounded-lg border border-gray-200 px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
      >
        <option value={10}>10</option>
        <option value={25}>25</option>
        <option value={50}>50</option>
      </select>
      <div className="relative max-w-xs flex-1">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Поиск"
          className="w-full rounded-lg border border-gray-200 py-1.5 pl-8 pr-3 text-sm transition-colors hover:border-gray-300 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-teal-500"
        />
      </div>
      <button
        type="button"
        onClick={onRefresh}
        className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-teal-50 hover:text-teal-600"
        title="Обновить"
      >
        <RefreshCw size={16} />
      </button>
      <button
        type="button"
        onClick={onExport}
        className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700 transition-colors hover:bg-emerald-100"
      >
        <FileSpreadsheet size={14} />
        Excel
      </button>
    </div>
  );
}
