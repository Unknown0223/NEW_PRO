import { FileDown, Printer, RotateCcw } from 'lucide-react';

interface ActionsBarProps {
  onUpdateStatus?: () => void;
  onPrint?: () => void;
  onExportPDF?: () => void;
  disabled?: boolean;
}

export default function ActionsBar({
  onUpdateStatus,
  onPrint,
  onExportPDF,
  disabled = false
}: ActionsBarProps) {
  const actions = [
    {
      id: 'update',
      label: 'Update Status',
      icon: RotateCcw,
      color: 'bg-blue-600 hover:bg-blue-700 text-white',
      onClick: onUpdateStatus
    },
    {
      id: 'print',
      label: 'Print',
      icon: Printer,
      color: 'bg-gray-100 hover:bg-gray-200 text-gray-700',
      onClick: onPrint
    },
    {
      id: 'export',
      label: 'Export PDF',
      icon: FileDown,
      color: 'bg-gray-100 hover:bg-gray-200 text-gray-700',
      onClick: onExportPDF
    }
  ];

  return (
    <div className="fixed bottom-0 left-64 right-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between">
      <div className="flex items-center gap-3">
        {actions.map((action) => (
          <button
            key={action.id}
            onClick={action.onClick}
            disabled={disabled}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              action.color
            } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            <action.icon className="w-4 h-4" />
            <span>{action.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
