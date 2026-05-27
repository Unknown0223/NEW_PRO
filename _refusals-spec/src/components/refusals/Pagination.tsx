import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  page: number;
  perPage: number;
  total: number;
  onPageChange: (p: number) => void;
}

export default function Pagination({ page, perPage, total, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(total / perPage);
  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  const getPages = (): (number | '...')[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);

    const pages: (number | '...')[] = [1];

    if (page > 3) pages.push('...');

    const start = Math.max(2, page - 1);
    const end = Math.min(totalPages - 1, page + 1);
    for (let i = start; i <= end; i++) pages.push(i);

    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);

    return pages;
  };

  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-white">
      <span className="text-xs text-gray-500">
        Показано{' '}
        <span className="font-medium text-gray-700">
          {from} – {to}
        </span>{' '}
        /{' '}
        <span className="font-medium text-gray-700">{total}</span>
      </span>

      <div className="flex items-center gap-1">
        {/* Prev */}
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft size={14} />
        </button>

        {/* Pages */}
        {getPages().map((p, i) =>
          p === '...' ? (
            <span key={`dots-${i}`} className="w-7 h-7 flex items-center justify-center text-xs text-gray-400">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p as number)}
              className={`w-7 h-7 flex items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                page === p
                  ? 'bg-teal-500 text-white shadow-sm'
                  : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              {p}
            </button>
          )
        )}

        {/* Next */}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
          className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
