import { ArrowDownWideNarrow, SlidersHorizontal, Search, RefreshCw, ChevronDown, FileSpreadsheet, Calendar, Columns3 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../utils/cn';
import type { ViewTab } from '../types';

interface Props {
  tab: ViewTab;
  perPage: number;
  onPerPage: (n: number) => void;
  search: string;
  onSearch: (s: string) => void; // debounced upstream value setter
  searching: boolean;
  onExcel: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  filtersOpen: boolean;
  onToggleFilters: () => void;
  activeFilterCount: number;
  dateFrom: string;
  dateTo: string;
  onDateFrom: (v: string) => void;
  onDateTo: (v: string) => void;
  showSystem: boolean;
  onShowSystem: (v: boolean) => void;
  sortDir: 'asc' | 'desc';
  onToggleSortDir: () => void;
  columns: { key: string; label: string; visible: boolean }[];
  onToggleColumn: (key: string) => void;
}

export default function Toolbar(p: Props) {
  const [local, setLocal] = useState(p.search);
  const [colsOpen, setColsOpen] = useState(false);
  const colsRef = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(null);

  // 500ms debounce → server side search
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (local !== p.search) p.onSearch(local);
    }, 500);
    return () => { if (timer.current) clearTimeout(timer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [local]);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (colsRef.current && !colsRef.current.contains(e.target as Node)) setColsOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-3 px-4 pt-4 pb-3">
      {/* Sort direction */}
      <button
        onClick={p.onToggleSortDir}
        title="Направление сортировки"
        className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"
      >
        <ArrowDownWideNarrow size={16} className={cn('transition-transform', p.sortDir === 'asc' && 'rotate-180')} />
      </button>

      {/* Column visibility */}
      <div className="relative" ref={colsRef}>
        <button
          onClick={() => setColsOpen(!colsOpen)}
          title="Колонки"
          className={cn('w-10 h-10 rounded-lg border flex items-center justify-center hover:bg-gray-50',
            colsOpen ? 'border-[#1aa096] text-[#1aa096]' : 'border-gray-200 text-gray-500')}
        >
          <Columns3 size={16} />
        </button>
        {colsOpen && (
          <div className="absolute z-30 top-11 left-0 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-2 max-h-72 overflow-y-auto">
            <div className="px-2 py-1 text-[11px] font-semibold text-gray-400 uppercase">Видимость колонок</div>
            {p.columns.map((c) => (
              <label key={c.key} className="flex items-center gap-2 px-2 py-1.5 text-[13px] text-gray-700 rounded hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={c.visible} onChange={() => p.onToggleColumn(c.key)} className="accent-[#1aa096] w-3.5 h-3.5" />
                {c.label}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Filters toggle */}
      <button
        onClick={p.onToggleFilters}
        title="Фильтры"
        className={cn(
          'relative w-10 h-10 rounded-lg border flex items-center justify-center hover:bg-gray-50',
          p.filtersOpen ? 'border-[#1aa096] text-[#1aa096] bg-teal-50' : 'border-gray-200 text-gray-500'
        )}
      >
        <SlidersHorizontal size={16} />
        {p.activeFilterCount > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#1aa096] text-white text-[10px] font-semibold flex items-center justify-center">
            {p.activeFilterCount}
          </span>
        )}
      </button>

      {/* Per page */}
      <div className="relative">
        <select
          value={p.perPage}
          onChange={(e) => p.onPerPage(Number(e.target.value))}
          className="h-10 pl-3 pr-8 rounded-lg border border-gray-200 text-[13px] text-gray-700 bg-white appearance-none focus:outline-none focus:border-[#1aa096] cursor-pointer"
        >
          {[10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
        <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
      </div>

      {/* Search */}
      <div className="relative w-[300px] max-w-full">
        {p.searching
          ? <RefreshCw size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#1aa096] animate-spin-slow" />
          : <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />}
        <input
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          placeholder="Поиск"
          className="w-full h-10 pl-9 pr-3 rounded-lg border border-gray-200 text-[13px] placeholder:text-gray-400 focus:outline-none focus:border-[#1aa096] focus:ring-2 focus:ring-teal-100"
        />
      </div>

      {/* Excel */}
      <button
        onClick={p.onExcel}
        className="flex items-center gap-2 h-10 px-3.5 rounded-lg border border-gray-200 text-[13px] text-gray-700 hover:bg-gray-50"
      >
        <FileSpreadsheet size={15} className="text-green-600" />
        Excel
      </button>

      {/* Refresh table */}
      <button
        onClick={p.onRefresh}
        title="Обновить таблицу"
        className="w-10 h-10 rounded-lg border border-gray-200 flex items-center justify-center text-gray-500 hover:bg-gray-50"
      >
        <RefreshCw size={15} className={p.refreshing ? 'animate-spin-slow text-[#1aa096]' : ''} />
      </button>

      <div className="flex-1" />

      {p.tab === 'detailed' && (
        <label className="flex items-center gap-2 text-[13px] text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={p.showSystem}
            onChange={(e) => p.onShowSystem(e.target.checked)}
            className="w-4 h-4 accent-[#1aa096]"
          />
          Показать системные операции
        </label>
      )}

      {/* Date range */}
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="absolute -top-2 left-2.5 bg-white px-1 text-[10px] text-gray-400 flex items-center gap-1"><Calendar size={9} /> Дата</div>
          <input
            type="date"
            value={p.dateFrom}
            onChange={(e) => p.onDateFrom(e.target.value)}
            className="h-10 w-[168px] px-3 rounded-lg border border-gray-200 text-[13px] text-gray-600 focus:outline-none focus:border-[#1aa096]"
            aria-label="Дата от"
          />
        </div>
        <div className="relative">
          <div className="absolute -top-2 left-2.5 bg-white px-1 text-[10px] text-gray-400 flex items-center gap-1"><Calendar size={9} /> Дата</div>
          <input
            type="date"
            value={p.dateTo}
            onChange={(e) => p.onDateTo(e.target.value)}
            className="h-10 w-[168px] px-3 rounded-lg border border-gray-200 text-[13px] text-gray-600 focus:outline-none focus:border-[#1aa096]"
            aria-label="Дата до"
          />
        </div>
      </div>
    </div>
  );
}
