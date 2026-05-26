import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  X,
  Truck,
  FileBarChart,
  FileText,
  Upload,
  Wallet,
  ArrowLeft,
  Settings,
} from 'lucide-react';

interface BulkActionsProps {
  selectedCount: number;
  onClose: () => void;
  onChangeStatus: (status: string) => void;
  onDeliveryAssign?: () => void;
  onOrderSummary?: () => void;
  onConsignment?: () => void;
  onCashIncome?: () => void;
  onOpenUploadModal: (title: string) => void;
}

type ViewMode = 'main' | 'upload';

export const BulkActions: React.FC<BulkActionsProps> = ({
  selectedCount,
  onClose,
  onChangeStatus,
  onDeliveryAssign,
  onOrderSummary,
  onConsignment,
  onCashIncome,
  onOpenUploadModal,
}) => {
  const [statusOpen, setStatusOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>('main');
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

  // Reset view on close
  const handleClose = () => {
    setViewMode('main');
    setStatusOpen(false);
    onClose();
  };

  if (selectedCount === 0) return null;

  // ============= UPLOAD VIEW =============
  if (viewMode === 'upload') {
    const uploadOptions = [
      { value: 'warehouse_manager', label: 'Загруз зав.склада' },
      { value: 'expediter', label: 'Загруз экспедитор' },
      { value: 'invoices', label: 'Накладные' },
      { value: 'register', label: 'Реестр' },
    ];

    return (
      <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-white rounded-xl shadow-2xl border border-gray-200 px-3 py-2 animate-expand">
        {/* Back arrow */}
        <button
          onClick={() => setViewMode('main')}
          className="flex items-center justify-center w-9 h-9 text-gray-600 hover:text-teal-700 hover:bg-teal-50 rounded-lg transition-colors flex-shrink-0"
          title="Назад"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>

        {/* Title */}
        <div className="px-2 text-sm font-medium text-gray-700 border-r border-gray-200 pr-3">
          Загрузить отдельными файлами
        </div>

        {/* 4 upload buttons */}
        <div className="flex items-center gap-2">
          {uploadOptions.map((opt) => (
            <UploadButton
              key={opt.value}
              label={opt.label}
              onClick={() => onOpenUploadModal(opt.label)}
            />
          ))}
        </div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="flex items-center justify-center w-9 h-9 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors ml-1"
          title="Закрыть"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    );
  }

  // ============= MAIN VIEW =============
  return (
    <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 bg-white rounded-xl shadow-2xl border border-gray-200 px-3 py-2 animate-expand">
      {/* Selected counter */}
      <div className="px-3 py-1.5 text-sm font-medium text-gray-700 border-r border-gray-200">
        Выбрано: <span className="text-teal-700 font-bold text-base">{selectedCount}</span>
      </div>

      {/* Изменить статус (green with dropdown) */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setStatusOpen(!statusOpen)}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-[#22c55e] hover:bg-green-600 rounded-lg transition-colors shadow-sm"
        >
          Изменить статус
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${statusOpen ? 'rotate-180' : ''}`} />
        </button>
        {statusOpen && (
          <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-xl min-w-[220px] py-1 animate-expand">
            {[
              { value: 'NEW', label: 'Новый', color: '#0369a1', dot: '#7dd3fc' },
              { value: 'CONFIRMED', label: 'Подтвержден к отгрузке', color: '#854d0e', dot: '#fde047' },
              { value: 'SHIPPED', label: 'Отгружен', color: '#9a3412', dot: '#fdba74' },
              { value: 'DELIVERED', label: 'Доставлен', color: '#166534', dot: '#86efac' },
              { value: 'CANCELLED', label: 'Отменен', color: '#4b5563', dot: '#d1d5db' },
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
                <span className="w-2 h-2 rounded-full" style={{ background: s.dot }} />
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Доставщик */}
      <button
        onClick={onDeliveryAssign}
        className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
      >
        <Truck className="w-4 h-4 text-gray-500" />
        Доставщик
      </button>

      {/* Итог по заказу */}
      <button
        onClick={onOrderSummary}
        className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
      >
        <FileBarChart className="w-4 h-4 text-gray-500" />
        Итог по заказу
      </button>

      {/* Консигнация */}
      <button
        onClick={onConsignment}
        className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
      >
        <FileText className="w-4 h-4 text-gray-500" />
        Консигнация
      </button>

      {/* Загрузка - switches to upload view */}
      <button
        onClick={() => setViewMode('upload')}
        className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 border border-gray-300 rounded-lg transition-colors"
      >
        <Upload className="w-4 h-4 text-gray-500" />
        Загрузка
      </button>

      {/* Приход в кассу (teal accent) */}
      <button
        onClick={onCashIncome}
        className="flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-300 rounded-lg transition-colors"
      >
        <Wallet className="w-4 h-4" />
        Приход в кассу
      </button>

      {/* Close button */}
      <button
        onClick={handleClose}
        className="flex items-center justify-center w-9 h-9 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors ml-1"
        title="Закрыть"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};

// ============================================================
// Upload sub-button (Settings icon + label + dropdown chevron)
// ============================================================
interface UploadButtonProps {
  label: string;
  onClick: () => void;
}

const UploadButton: React.FC<UploadButtonProps> = ({ label, onClick }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-teal-700 bg-white hover:bg-teal-50 border border-teal-300 rounded-lg transition-colors min-w-[170px]"
      >
        <Settings className="w-4 h-4 text-teal-600" />
        <span className="flex-1 text-left">{label}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-teal-600 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute bottom-full left-0 mb-2 bg-white border border-gray-200 rounded-lg shadow-xl min-w-[200px] py-1 animate-expand z-50">
          <button
            onClick={() => {
              onClick();
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <Upload className="w-3.5 h-3.5 text-gray-500" />
            Скачать Excel
          </button>
          <button
            onClick={() => {
              onClick();
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <FileText className="w-3.5 h-3.5 text-gray-500" />
            Скачать PDF
          </button>
          <button
            onClick={() => {
              onClick();
              setOpen(false);
            }}
            className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors flex items-center gap-2"
          >
            <FileText className="w-3.5 h-3.5 text-gray-500" />
            Печать
          </button>
        </div>
      )}
    </div>
  );
};
