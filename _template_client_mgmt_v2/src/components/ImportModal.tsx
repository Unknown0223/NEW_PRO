import { useState, useRef } from 'react';
import { X, FileSpreadsheet, Upload } from 'lucide-react';

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
}

export const ImportModal = ({ open, onClose, title }: ImportModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9998] flex items-center justify-center bg-[#013532]/30 backdrop-blur-[1px] animate-in fade-in"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[700px] mx-4 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4">
          <h3 className="text-lg font-bold text-gray-800">{title}</h3>

          <div className="flex items-center gap-3">
            <button className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              Скачать шаблон
            </button>
            <button
              onClick={onClose}
              className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        <div className="px-6 pb-6 grid grid-cols-2 gap-3">
          {/* File chooser */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex items-center justify-center gap-2 py-3 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors"
          >
            <Upload className="w-4 h-4 text-gray-500" />
            <span className="truncate">
              {file ? file.name : 'Выберите Excel файл'}
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={e => setFile(e.target.files?.[0] || null)}
          />

          {/* Save button */}
          <button
            disabled={!file}
            className="py-3 text-sm font-bold text-white bg-emerald-500 hover:bg-emerald-600 disabled:bg-emerald-300 disabled:cursor-not-allowed rounded-lg transition-colors"
            onClick={() => {
              // TODO: handle upload
              onClose();
              setFile(null);
            }}
          >
            Сохранить
          </button>
        </div>
      </div>
    </div>
  );
};
