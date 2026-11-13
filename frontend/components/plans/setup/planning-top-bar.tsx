"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Calendar,
  ChevronDown,
  ExternalLink,
  FileSpreadsheet,
  Upload
} from "lucide-react";
import { PLANNING_MONTHS } from "./planning-utils";
import type { PlanningCompletionFilter, PlanningIssueFilter } from "./planning-scope-filters";
import {
  PlanningFilterDropdown,
  PlanningSegmentFilter,
  type PlanningFilterOption
} from "./planning-filter-dropdown";
import { cn } from "@/lib/utils";

export type { PlanningFilterOption };

interface PlanningTopBarProps {
  month: number;
  year: number;
  tradeDirection: string;
  tradeDirections: string[];
  onMonthChange: (month: number, year: number) => void;
  onTradeDirectionChange: (name: string) => void;
  searchQuery: string;
  onSearch: (query: string) => void;
  onRefresh: () => void;
  loading?: boolean;
  directionId?: number | null;
  canImport?: boolean;
  onDownloadTemplate?: () => void;
  onImportFile?: (file: File) => void;
  importBusy?: boolean;
  filialOptions: PlanningFilterOption[];
  svrOptions: PlanningFilterOption[];
  kpiOptions: PlanningFilterOption[];
  filialIds: number[];
  svrIds: number[];
  kpiIds: number[];
  onFilialIdsChange: (ids: number[]) => void;
  onSvrIdsChange: (ids: number[]) => void;
  onKpiIdsChange: (ids: number[]) => void;
  completionFilter: PlanningCompletionFilter;
  issueFilter: PlanningIssueFilter;
  onCompletionFilterChange: (v: PlanningCompletionFilter) => void;
  onIssueFilterChange: (v: PlanningIssueFilter) => void;
}

export function PlanningTopBar({
  month,
  year,
  tradeDirection,
  tradeDirections,
  onMonthChange,
  onTradeDirectionChange,
  searchQuery,
  onSearch,
  onRefresh,
  loading = false,
  directionId = null,
  canImport = false,
  onDownloadTemplate,
  onImportFile,
  importBusy = false,
  filialOptions,
  svrOptions,
  kpiOptions,
  filialIds,
  svrIds,
  kpiIds,
  onFilialIdsChange,
  onSvrIdsChange,
  onKpiIdsChange,
  completionFilter,
  issueFilter,
  onCompletionFilterChange,
  onIssueFilterChange
}: PlanningTopBarProps) {
  const [tdOpen, setTdOpen] = useState(false);

  const dailyHref = (() => {
    const qs = new URLSearchParams({ month: String(month), year: String(year) });
    if (directionId != null) qs.set("direction_id", String(directionId));
    const today = new Date();
    const wr = new Date(today.getTime() + 5 * 3_600_000);
    const ymd = wr.toISOString().slice(0, 10);
    if (ymd.startsWith(`${year}-${String(month).padStart(2, "0")}`)) qs.set("day", ymd);
    else qs.set("day", `${year}-${String(month).padStart(2, "0")}-01`);
    return `/plans/daily?${qs.toString()}`;
  })();

  const changeMonth = (delta: number) => {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth > 12) {
      newMonth = 1;
      newYear += 1;
    } else if (newMonth < 1) {
      newMonth = 12;
      newYear -= 1;
    }
    onMonthChange(newMonth, newYear);
  };

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white px-5 py-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h1 className="text-lg font-semibold text-slate-800">Установка планов</h1>
        <Link
          href={dailyHref}
          className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:border-teal-300 hover:bg-teal-50 hover:text-teal-800"
        >
          Дневные KPI планы
          <ExternalLink className="h-3 w-3 opacity-60" />
        </Link>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Поиск по Ф.И.О"
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
              className="h-9 w-52 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-teal-500"
            />
          </div>
          <PlanningFilterDropdown
            label="Филиалы"
            emptyLabel="Филиалы"
            options={filialOptions}
            selectedIds={filialIds}
            onChange={(ids) => {
              onFilialIdsChange(ids);
              onSvrIdsChange([]);
            }}
            aria-label="Филиал"
          />
          <PlanningFilterDropdown
            label="Супервайзеры"
            emptyLabel="Супервайзеры"
            options={svrOptions}
            selectedIds={svrIds}
            onChange={onSvrIdsChange}
            aria-label="Супервайзер"
          />
          <PlanningFilterDropdown
            label="KPI"
            emptyLabel="KPI"
            options={kpiOptions}
            selectedIds={kpiIds}
            onChange={onKpiIdsChange}
            aria-label="KPI"
          />
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-teal-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          {canImport ? (
            <>
              <button
                type="button"
                onClick={() => onDownloadTemplate?.()}
                disabled={importBusy || loading}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                title="Скачать Excel-шаблон"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                Шаблон
              </button>
              <label
                className={cn(
                  "inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-lg border border-teal-200 bg-teal-50 px-2.5 text-xs font-medium text-teal-800 hover:bg-teal-100",
                  (importBusy || loading) && "pointer-events-none opacity-50"
                )}
              >
                <Upload className="h-3.5 w-3.5" />
                {importBusy ? "Чтение…" : "Импорт Excel"}
                <input
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  disabled={importBusy || loading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) onImportFile?.(f);
                  }}
                />
              </label>
            </>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-lg border border-slate-200 bg-white">
            <button
              type="button"
              onClick={() => changeMonth(-1)}
              className="flex h-9 w-8 items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-700"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-1.5 border-x border-slate-200 px-3">
              <span className="text-[10px] uppercase tracking-wide text-slate-400">Месяц и год</span>
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-sm font-medium text-slate-700">
                {PLANNING_MONTHS[month - 1]} {year}
              </span>
            </div>
            <button
              type="button"
              onClick={() => changeMonth(1)}
              className="flex h-9 w-8 items-center justify-center text-slate-400 hover:bg-slate-50 hover:text-slate-700"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setTdOpen(!tdOpen)}
              className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 hover:bg-slate-50"
            >
              <div className="text-left">
                <span className="block text-[10px] uppercase leading-none tracking-wide text-slate-400">
                  Направление торговли
                </span>
                <span className="text-sm font-medium text-slate-700">{tradeDirection}</span>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </button>
            {tdOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setTdOpen(false)} aria-hidden />
                <div className="absolute right-0 z-50 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  {tradeDirections.map((td) => (
                    <button
                      key={td}
                      type="button"
                      onClick={() => {
                        onTradeDirectionChange(td);
                        setTdOpen(false);
                      }}
                      className="flex w-full items-center px-3 py-2 text-sm hover:bg-slate-50"
                    >
                      {td}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-2">
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Статус</span>
        <PlanningSegmentFilter
          aria-label="Статус плана"
          value={completionFilter}
          onChange={onCompletionFilterChange}
          options={[
            { value: "all", label: "Все" },
            { value: "closed", label: "Закрытые" },
            { value: "open", label: "Незавершённые" }
          ]}
        />
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-400">Проблемы</span>
        <PlanningSegmentFilter
          aria-label="Проблемы плана"
          value={issueFilter}
          onChange={onIssueFilterChange}
          options={[
            { value: "all", label: "Все" },
            { value: "problem", label: "Проблемные" },
            { value: "ok", label: "Без проблем" }
          ]}
        />
      </div>
    </div>
  );
}
