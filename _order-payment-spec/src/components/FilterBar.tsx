import type { Filters } from '../types';

interface FilterBarProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  kassas: string[];
  onSuccessCount: number;
  totalCount: number;
}

export default function FilterBar({
  filters,
  onChange,
  kassas,
  onSuccessCount,
  totalCount,
}: FilterBarProps) {
  const progress = totalCount === 0 ? 0 : Math.round((onSuccessCount / totalCount) * 100);
  const hasErrors = onSuccessCount < totalCount;

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="bg-white rounded-lg border border-slate-200 p-4">
        <div
          className={`relative w-full h-9 rounded-md flex items-center justify-center font-medium text-sm ${
            hasErrors
              ? 'bg-gradient-to-r from-emerald-100 to-teal-100 text-teal-700 border border-teal-200'
              : 'bg-gradient-to-r from-emerald-100 to-teal-100 text-teal-700 border border-teal-200'
          }`}
        >
          <div
            className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-emerald-400 to-teal-500 rounded-md transition-all"
            style={{ width: `${progress}%` }}
          ></div>
          <span className="relative z-10">
            Успешно {onSuccessCount} из {totalCount} ({progress}%)
          </span>
        </div>

        <label className="flex items-center gap-2 mt-3 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={filters.errorOnly}
            onChange={(e) => onChange({ ...filters, errorOnly: e.target.checked })}
            className="w-4 h-4 rounded border-slate-300"
          />
          Показать только ошибочные платежи
        </label>
      </div>

      {/* Filter controls */}
      <div className="flex flex-wrap items-center gap-3 justify-end">
        <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-md px-3 py-2">
          <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-xs text-slate-500">Дата</span>
          <div className="flex items-center gap-1">
            <button className="p-1 hover:bg-slate-100 rounded">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <input
              type="datetime-local"
              value={filters.date}
              onChange={(e) => onChange({ ...filters, date: e.target.value })}
              className="text-sm border-0 bg-transparent focus:ring-0"
            />
            <button className="p-1 hover:bg-slate-100 rounded">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>

        <select
          value={filters.kassa}
          onChange={(e) => onChange({ ...filters, kassa: e.target.value })}
          className="px-3 py-2 bg-white border border-slate-200 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-teal-400"
        >
          {kassas.map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
