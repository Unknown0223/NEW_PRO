import React, { useState, useRef, useEffect } from 'react';
import { X, Download, FileSpreadsheet, FileText, Printer, Check } from 'lucide-react';

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  selectedCount: number;
  onDownload: (template: string) => void;
}

export const UploadModal: React.FC<UploadModalProps> = ({
  open,
  onClose,
  title,
  selectedCount,
  onDownload,
}) => {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setSelectedTemplate(null);
      return;
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const handleClick = (e: MouseEvent) => {
      if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    document.addEventListener('mousedown', handleClick);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.removeEventListener('mousedown', handleClick);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const templates = [
    {
      id: 'excel',
      label: 'Скачать Excel',
      description: 'Yuklash uchun Excel shablon',
      icon: FileSpreadsheet,
      color: 'text-green-700',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
    },
    {
      id: 'pdf',
      label: 'Скачать PDF',
      description: 'Yuklash uchun PDF shablon',
      icon: FileText,
      color: 'text-red-700',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
    },
    {
      id: 'print',
      label: 'Печать',
      description: 'Chop etish uchun tayyorlash',
      icon: Printer,
      color: 'text-blue-700',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
    },
  ];

  const handleDownload = (templateId: string) => {
    onDownload(templateId);
    setSelectedTemplate(templateId);
    setTimeout(() => {
      setSelectedTemplate(null);
      onClose();
    }, 1500);
  };

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
    >
      {/* Modal - slides from bottom */}
      <div className="bg-white rounded-t-2xl shadow-2xl w-full max-w-2xl animate-slide-up max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Tanlangan: <span className="text-teal-700 font-semibold">{selectedCount}</span> ta zakaz
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {templates.map((template) => {
              const Icon = template.icon;
              const isSelected = selectedTemplate === template.id;

              return (
                <button
                  key={template.id}
                  onClick={() => handleDownload(template.id)}
                  disabled={isSelected}
                  className={`relative p-5 rounded-xl border-2 transition-all duration-200 group ${
                    isSelected
                      ? `${template.bgColor} ${template.borderColor} scale-[0.98]`
                      : `bg-white border-gray-200 hover:border-teal-300 hover:shadow-md`
                  }`}
                >
                  {/* Success checkmark */}
                  {isSelected && (
                    <div className="absolute top-2 right-2 text-green-600 animate-scale-in">
                      <Check className="w-5 h-5" />
                    </div>
                  )}

                  {/* Icon */}
                  <div className={`w-12 h-12 rounded-lg ${template.bgColor} flex items-center justify-center mb-3 mx-auto`}>
                    <Icon className={`w-6 h-6 ${template.color}`} />
                  </div>

                  {/* Label */}
                  <h4 className={`font-semibold text-sm mb-1 ${template.color}`}>
                    {template.label}
                  </h4>

                  {/* Description */}
                  <p className="text-xs text-gray-500 text-center">
                    {template.description}
                  </p>

                  {/* Download icon on hover */}
                  {!isSelected && (
                    <div className="absolute inset-0 flex items-center justify-center bg-white/90 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity">
                      <Download className="w-8 h-8 text-teal-600" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Info box */}
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 rounded-full bg-blue-200 flex items-center justify-center flex-shrink-0 mt-0.5">
                <span className="text-blue-700 text-xs font-bold">i</span>
              </div>
              <div>
                <p className="text-sm text-blue-800 font-medium">Ma'lumot</p>
                <p className="text-xs text-blue-600 mt-1">
                  Tanlangan shablon avtomatik yuklab olinadi. Faylni to'ldirib, qayta yuklashingiz mumkin.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="w-full py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
          >
            Bekor qilish
          </button>
        </div>
      </div>
    </div>
  );
};
