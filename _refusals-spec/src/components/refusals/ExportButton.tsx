import { useState } from 'react';
import { FileSpreadsheet } from 'lucide-react';

interface ExportButtonProps {
  onExport?: () => Promise<void>;
}

export default function ExportButton({ onExport }: ExportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      if (onExport) {
        await onExport();
      } else {
        // Simulate GET /refusals/export
        await new Promise((res) => setTimeout(res, 1000));
        // In real implementation, trigger download
        const link = document.createElement('a');
        link.href = '#';
        link.download = 'refusals.xlsx';
        link.click();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-1.5 bg-white hover:bg-green-50 text-green-700 border border-green-300 hover:border-green-400 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
    >
      {loading ? (
        <svg className="animate-spin w-3.5 h-3.5" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
      ) : (
        <FileSpreadsheet size={14} className="text-green-600" />
      )}
      Excel
    </button>
  );
}
