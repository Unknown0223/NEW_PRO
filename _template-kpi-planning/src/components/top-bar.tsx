"use client";

import { useState } from "react";
import { Search, RefreshCw, ChevronLeft, ChevronRight, Calendar, ChevronDown, MapPin, Star } from "lucide-react";

const months = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

interface TopBarProps {
  month: number;
  year: number;
  tradeDirection: string;
  tradeDirections: string[];
  onMonthChange: (month: number, year: number) => void;
  onTradeDirectionChange: (td: string) => void;
  onSearch: (query: string) => void;
  onRefresh: () => void;
}

export function TopBar({
  month,
  year,
  tradeDirection,
  tradeDirections,
  onMonthChange,
  onTradeDirectionChange,
  onSearch,
  onRefresh,
}: TopBarProps) {
  const [search, setSearch] = useState("");
  const [tdOpen, setTdOpen] = useState(false);

  const changeMonth = (delta: number) => {
    let newMonth = month + delta;
    let newYear = year;
    if (newMonth > 12) { newMonth = 1; newYear++; }
    else if (newMonth < 1) { newMonth = 12; newYear--; }
    onMonthChange(newMonth, newYear);
  };

  return (
    <>
      {/* Top navigation bar */}
      <div className="flex items-center justify-between h-10 border-b border-slate-200 bg-white px-5">
        <div className="flex items-center gap-4">
          <button className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700">
            <MapPin className="h-3.5 w-3.5 text-teal-600" />
            GPS
          </button>
          <button className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700">
            <Star className="h-3.5 w-3.5" />
            Избранные страницы
            <ChevronDown className="h-3 w-3" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full overflow-hidden bg-slate-200">
            <img
              src="https://api.dicebear.com/7.x/avataaars/svg?seed=admin"
              alt="User"
              className="h-full w-full object-cover"
            />
          </div>
        </div>
      </div>

      {/* Title + Search + Filters */}
      <div className="bg-white border-b border-slate-200 px-5 py-3">
        <h1 className="text-lg font-semibold text-slate-800 mb-3">Установка планов</h1>
        <div className="flex items-center justify-between">
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
                className="h-9 w-52 rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-teal-500 transition-colors"
              />
            </div>
            <button
              onClick={onRefresh}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-teal-600 hover:bg-slate-50 transition-colors"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          <div className="flex items-center gap-3">
            {/* Month/Year Selector */}
            <div className="flex items-center rounded-lg border border-slate-200 bg-white">
              <button
                onClick={() => changeMonth(-1)}
                className="flex h-9 w-8 items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-l-lg transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-1.5 px-3 border-x border-slate-200">
                <span className="text-[10px] text-slate-400 uppercase tracking-wide">Месяц и год</span>
                <div className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 text-slate-500" />
                  <span className="text-sm font-medium text-slate-700">
                    {months[month - 1]} {year}
                  </span>
                </div>
              </div>
              <button
                onClick={() => changeMonth(1)}
                className="flex h-9 w-8 items-center justify-center text-slate-400 hover:text-slate-700 hover:bg-slate-50 rounded-r-lg transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Trade Direction */}
            <div className="relative">
              <button
                onClick={() => setTdOpen(!tdOpen)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 h-9 hover:bg-slate-50 transition-colors"
              >
                <div className="text-left">
                  <span className="block text-[10px] text-slate-400 uppercase tracking-wide leading-none">
                    Направление торговли
                  </span>
                  <span className="text-sm font-medium text-slate-700">{tradeDirection}</span>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>
              {tdOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setTdOpen(false)} />
                  <div className="absolute right-0 z-50 mt-1 w-44 rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                    {tradeDirections.map((td) => (
                      <button
                        key={td}
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
    </>
  );
}
