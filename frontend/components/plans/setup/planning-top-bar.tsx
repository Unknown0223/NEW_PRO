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
  ExternalLink
} from "lucide-react";
import { PLANNING_MONTHS } from "./planning-utils";

interface PlanningTopBarProps {
  month: number;
  year: number;
  tradeDirection: string;
  tradeDirections: string[];
  onMonthChange: (month: number, year: number) => void;
  onTradeDirectionChange: (name: string) => void;
  onSearch: (query: string) => void;
  onRefresh: () => void;
  loading?: boolean;
  directionId?: number | null;
}

export function PlanningTopBar({
  month,
  year,
  tradeDirection,
  tradeDirections,
  onMonthChange,
  onTradeDirectionChange,
  onSearch,
  onRefresh,
  loading = false,
  directionId = null
}: PlanningTopBarProps) {
  const [search, setSearch] = useState("");
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
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Поиск"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                onSearch(e.target.value);
              }}
              className="h-9 w-52 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-teal-500"
            />
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-teal-600 hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
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
    </div>
  );
}
