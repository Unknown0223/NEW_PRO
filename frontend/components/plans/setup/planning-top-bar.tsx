"use client";

import { useState } from "react";
import { Search, RefreshCw, ChevronLeft, ChevronRight, Calendar, ChevronDown } from "lucide-react";
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
  loading = false
}: PlanningTopBarProps) {
  const [search, setSearch] = useState("");
  const [tdOpen, setTdOpen] = useState(false);

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
      <h1 className="text-lg font-semibold text-slate-800">Установка планов</h1>
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
