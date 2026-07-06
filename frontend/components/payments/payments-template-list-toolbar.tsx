"use client";

import { ClientsListSearchInput } from "@/components/clients/clients-list-search-input";
import { Download, RotateCw, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

type Props = {
  search: string;
  onSearchChange: (v: string) => void;
  pageSize: number;
  onPageSizeChange: (n: number) => void;
  onRefresh: () => void;
  refreshing?: boolean;
  onExportExcel?: () => void;
  exportDisabled?: boolean;
  onOpenFilterVisibility?: () => void;
  showEditGrantsLink?: boolean;
};

export function PaymentsTemplateListToolbar({
  search,
  onSearchChange,
  pageSize,
  onPageSizeChange,
  onRefresh,
  refreshing = false,
  onExportExcel,
  exportDisabled = false,
  onOpenFilterVisibility,
  showEditGrantsLink = true
}: Props) {
  return (
    <div className="space-y-3">
      <div
        className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 shadow-sm"
        role="toolbar"
      >
        {onOpenFilterVisibility ? (
          <button
            type="button"
            onClick={onOpenFilterVisibility}
            className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted"
            title="Видимость фильтров"
          >
            <SlidersHorizontal className="h-4 w-4 text-gray-600" />
          </button>
        ) : null}
        <select
          className="h-8 cursor-pointer rounded-md border-none bg-transparent pr-6 text-xs font-semibold text-gray-800 focus:ring-0"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value))}
          aria-label="Строк на странице"
        >
          {[15, 10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <div className="mx-1 hidden h-5 w-px shrink-0 bg-muted md:block" />
        <ClientsListSearchInput value={search} onChange={onSearchChange} className="min-w-[9rem] flex-1" />
        {onExportExcel ? (
          <button
            type="button"
            disabled={exportDisabled}
            onClick={onExportExcel}
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 text-xs font-medium text-gray-800 transition-colors hover:border-border hover:bg-muted disabled:opacity-50"
          >
            <Download className="h-4 w-4 text-emerald-600" />
            Excel
          </button>
        ) : null}
        <button
          type="button"
          onClick={onRefresh}
          className="flex h-8 w-8 items-center justify-center rounded-md transition-colors hover:bg-muted"
          title="Обновить"
        >
          <RotateCw className={cn("h-4 w-4 text-gray-600", refreshing && "animate-spin")} />
        </button>
      </div>
      {showEditGrantsLink ? (
        <div className="text-right">
          <Link
            href="/payments/edit-grants"
            className="text-sm font-medium text-emerald-600 hover:text-emerald-700 hover:underline"
          >
            Список платежей, разрешенных для изменения
          </Link>
        </div>
      ) : null}
    </div>
  );
}
