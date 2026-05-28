import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useClientStore } from '../store/useClientStore';

export const Pagination = () => {
  const { pagination, setPagination } = useClientStore();
  const { page, pageSize, total } = pagination;

  const totalPages = Math.ceil(total / pageSize);
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(page * pageSize, total);

  // Generate page numbers
  const pages: (number | string)[] = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push('...');
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
      if (!pages.includes(i)) pages.push(i);
    }
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-100">
      <div className="text-sm text-gray-500">
        Показано <span className="font-medium text-gray-900">{start} - {end}</span> / <span className="font-medium text-gray-900">{total}</span>
      </div>

      <div className="flex items-center gap-1">
        <button
          onClick={() => setPagination({ page: Math.max(1, page - 1) })}
          disabled={page === 1}
          className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-4 h-4 text-gray-600" />
        </button>

        {pages.map((p, i) => (
          <button
            key={i}
            onClick={() => typeof p === 'number' && setPagination({ page: p })}
            className={`w-8 h-8 text-sm font-medium rounded transition-colors ${
              p === page
                ? 'bg-emerald-500 text-white border border-emerald-500'
                : 'text-gray-600 hover:bg-gray-50 border border-gray-200'
            } ${typeof p !== 'number' ? 'cursor-default border-none' : ''}`}
          >
            {p}
          </button>
        ))}

        <button
          onClick={() => setPagination({ page: Math.min(totalPages, page + 1) })}
          disabled={page === totalPages}
          className="w-8 h-8 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-4 h-4 text-gray-600" />
        </button>
      </div>
    </div>
  );
};
