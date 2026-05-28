import { useState } from 'react';
import { Search, FileSpreadsheet, RotateCcw, SlidersHorizontal, RefreshCw, Download, Layers } from 'lucide-react';
import { useClientStore } from '../store/useClientStore';
import { ImportModal } from './ImportModal';

export const ClientsToolbar = () => {
  const { search, setSearch } = useClientStore();
  const [updateModal, setUpdateModal] = useState(false);
  const [importModal, setImportModal] = useState(false);

  return (
    <>
      <div className="space-y-3">
        {/* ─── Title row + action buttons ─── */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <h3 className="text-xl font-bold text-gray-800">Список клиенты</h3>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setUpdateModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 text-[13px] font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              <RefreshCw className="w-4 h-4 text-gray-500" />
              Обновление клиентов с Excel
            </button>
            <button
              onClick={() => setImportModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 text-[13px] font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
            >
              <Download className="w-4 h-4 text-gray-500" />
              Импорт
            </button>
            <button className="flex items-center gap-2 px-3.5 py-2 text-[13px] font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors">
              <Layers className="w-4 h-4 text-gray-500" />
              Групповая обработка
            </button>
          </div>
        </div>

        {/* ─── Toolbar row ─── */}
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2 py-1.5 shadow-sm">
          {/* Left controls */}
          <div className="flex items-center gap-0.5">
            <button className="p-1.5 hover:bg-gray-100 rounded transition-colors" title="Сбросить">
              <RotateCcw className="w-4 h-4 text-gray-500" />
            </button>
            <button className="p-1.5 hover:bg-gray-100 rounded transition-colors" title="Фильтр">
              <SlidersHorizontal className="w-4 h-4 text-gray-500" />
            </button>
            <select className="text-sm border-none focus:ring-0 cursor-pointer bg-transparent font-medium text-gray-700 pr-6 py-0">
              <option>10</option>
              <option>20</option>
              <option>50</option>
              <option>100</option>
            </select>
          </div>

          <div className="w-px h-5 bg-gray-200 mx-1" />

          {/* Search */}
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

      {/* ─── Modals ─── */}
      <ImportModal
        open={updateModal}
        onClose={() => setUpdateModal(false)}
        title="Обновление клиентов с Excel"
      />
      <ImportModal
        open={importModal}
        onClose={() => setImportModal(false)}
        title="Импорт клиент"
      />
    </>
  );
};
