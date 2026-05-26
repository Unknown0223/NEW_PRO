import { FileDown } from 'lucide-react';

export default function ActionsBar() {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button className="inline-flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50">
        <FileDown size={15} />
        Export PDF
      </button>
    </div>
  );
}
