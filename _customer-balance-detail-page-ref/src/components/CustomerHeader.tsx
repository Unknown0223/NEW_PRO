import { RefreshCw } from 'lucide-react';
import type { Customer } from '../types';

interface Props {
  customer: Customer;
  showOverall: boolean;
  onToggleOverall: (v: boolean) => void;
  onRefresh: () => void;
  refreshing: boolean;
}

export default function CustomerHeader({ customer, showOverall, onToggleOverall, onRefresh, refreshing }: Props) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="flex flex-wrap items-baseline gap-x-10 gap-y-1">
        <div>
          <h1 className="text-[24px] leading-7 font-bold text-[#1aa096] tracking-wide">{customer.name}</h1>
          <div className="text-[15px] font-semibold text-gray-800 mt-1">{customer.name}</div>
        </div>
        <div className="flex items-baseline gap-2 text-[13px]">
          <span className="font-semibold text-gray-700">Тел:</span>
          <span className="text-gray-500">{customer.phone || '—'}</span>
        </div>
        <div className="flex items-baseline gap-2 text-[13px]">
          <span className="font-semibold text-gray-700">Территория:</span>
          <span className="text-gray-600">{customer.territory}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-[13px] text-gray-600 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={showOverall}
            onChange={(e) => onToggleOverall(e.target.checked)}
            className="w-4 h-4 rounded border-gray-300 accent-[#1aa096]"
          />
          Показать общий блок
        </label>
        <button
          onClick={onRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 h-10 px-4 rounded-lg bg-[#1aa096] text-white text-[13px] font-medium hover:bg-[#158a81] active:scale-[0.98] transition disabled:opacity-70 shadow-sm"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin-slow' : ''} />
          Обновить данные
        </button>
      </div>
    </div>
  );
}
