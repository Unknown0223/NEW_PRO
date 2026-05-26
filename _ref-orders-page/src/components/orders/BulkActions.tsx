import React, { useState, useRef, useEffect } from 'react';
import { Trash2, FileDown, Printer, ChevronDown } from 'lucide-react';

interface BulkActionsProps {
  selectedCount: number;
  onDelete: () => void;
  onExport: () => void;
  onPrint: () => void;
  onChangeStatus: (status: string) => void;
}

export const BulkActions: React.FC<BulkActionsProps> = ({
  selectedCount,
  onDelete,
  onExport,
  onPrint,
  onChangeStatus,
}) => {
  const [statusOpen, setStatusOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setStatusOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  if (selectedCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-white rounded-xl shadow-2xl border border-gray-200 px-3 py-2 animate-expand">
      <div className="px-3 py-1.5 text-sm font-medium text-gray-700 border-r border-gray-200">
        Выбрано: <span className="text-teal-700 font-semibold">{selectedCount}</span>
      </div>

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setStatusOpen(!statusOpen)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#22c55e] hover:bg-green-600 rounded-lg transition-colors"
        >
          Изменить статус
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
        {statusOpen && (
          <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-xl min-w-[200px] py-1 animate-expand">
            {[
              { value: 'NEW', label: 'Новый', color: '#0369a1' },
              { value: 'CONFIRMED', label: 'Подтвержден к отгрузке', color: '#854d0e' },
              { value: 'SHIPPED', label: 'Отгружен', color: '#9a3412' },
              { value: 'DELIVERED', label: 'Доставлен', color: '#166534' },
              { value: 'CANCELLED', label: 'Отменен', color: '#4b5563' },
            ].map((s) => (
              <button
                key={s.value}
                type="button"
                onClick={() => {
                  onChangeStatus(s.value);
                  setStatusOpen(false);
                }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
                style={{ color: s.color }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={onExport}
        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
      >
        <FileDown className="w-4 h-4" />
        Экспорт
      </button>

      <button
        onClick={onPrint}
        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
      >
        <Printer className="w-4 h-4" />
        Печать
      </button>

      <button
        onClick={onDelete}
        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#ef4444] hover:bg-red-600 rounded-lg transition-colors"
      >
        <Trash2 className="w-4 h-4" />
        Удалить
      </button>
    </div>
  );
};
