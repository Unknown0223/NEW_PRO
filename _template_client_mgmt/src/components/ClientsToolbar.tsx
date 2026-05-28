import { Search, FileSpreadsheet, RotateCcw, SlidersHorizontal, RefreshCw, Download, Layers } from 'lucide-react';
import { useClientStore } from '../store/useClientStore';

export const ClientsToolbar = () => {
  const { search, setSearch } = useClientStore();

  return (
    <div className="space-y-3">
      {/* Title row */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-gray-800">Список клиенты</h3>
        <div className="flex gap-2">
          <button className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <RefreshCw className="w-3.5 h-3.5" />
            Обновление клиентов с Excel
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Download className="w-3.5 h-3.5" />
            Импорт
          </button>
          <button className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Layers className="w-3.5 h-3.5" />
            Групповая обработка
          </button>
        </div>
      </div>

      {/* Toolbar row - More compact */}
      <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2 py-1.5 shadow-sm">
        {/* Left controls */}
        <div className="flex items-center gap-0.5">
          <button className="p-1.5 hover:bg-gray-100 rounded transition-colors" title="Сбросить">
            <RotateCcw className="w-4 h-4 text-gray-500" />
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded transition-colors" title="Фильтр">
            <SlidersHorizontal className="w-4 h-4 text-gray-500" />
          </button>
          <select
            className="text-sm border-none focus:ring-0 cursor-pointer bg-transparent font-medium text-gray-700 pr-6 py-0"
          >
            <option>10</option>
            <option>20</option>
            <option>50</option>
            <option>100</option>
          </select>
        </div>

        {/* Divider */}
        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Compact Search */}
        <div className="relative max-w-[300px] w-full">
          <Search className="w-4 h-4 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Поиск"
            className="w-full pl-8 pr-4 py-1 text-sm bg-transparent border-none focus:ring-0 outline-none placeholder:text-gray-400"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex-1" />

        {/* Right controls */}
        <div className="flex items-center gap-1">
          <button className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-emerald-600 hover:bg-emerald-50 rounded transition-colors">
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </button>
          <button className="p-1.5 hover:bg-gray-100 rounded transition-colors text-gray-500" title="Обновить">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
