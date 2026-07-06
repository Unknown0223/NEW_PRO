import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { cn } from '../utils/cn';

interface Props {
  page: number;
  perPage: number;
  total: number;
  onPage: (p: number) => void;
}

function pageList(page: number, totalPages: number): (number | '...')[] {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const set = new Set<number>([1, 2, totalPages - 1, totalPages, page - 1, page, page + 1]);
  const arr = [...set].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  const out: (number | '...')[] = [];
  arr.forEach((n, i) => {
    if (i > 0 && n - arr[i - 1] > 1) out.push('...');
    out.push(n);
  });
  return out;
}

export default function Pagination({ page, perPage, total, onPage }: Props) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const from = total === 0 ? 0 : (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);
  const [jump, setJump] = useState('');

  const goJump = () => {
    const n = Number(jump);
    if (n >= 1 && n <= totalPages) onPage(n);
    setJump('');
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 border-t border-gray-200">
      <div className="text-[13px] text-gray-500">
        Показано <span className="text-[#1aa096] font-medium">{from} - {to} / {total}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <div className="flex items-center gap-1.5 mr-3 text-[12px] text-gray-500">
          <span>Перейти:</span>
          <input
            value={jump}
            onChange={(e) => setJump(e.target.value.replace(/\D/g, ''))}
            onKeyDown={(e) => e.key === 'Enter' && goJump()}
            className="w-14 h-8 px-2 rounded-md border border-gray-200 text-[12px] text-center focus:outline-none focus:border-[#1aa096]"
            placeholder="№"
          />
        </div>
        <button
          disabled={page <= 1}
          onClick={() => onPage(page - 1)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronLeft size={15} />
        </button>
        {pageList(page, totalPages).map((n, i) =>
          n === '...' ? (
            <span key={`d${i}`} className="w-8 text-center text-gray-400 text-[13px]">…</span>
          ) : (
            <button
              key={n}
              onClick={() => onPage(n)}
              className={cn(
                'min-w-8 h-8 px-1 rounded-lg text-[13px] font-medium transition-colors',
                n === page ? 'bg-[#1aa096] text-white' : 'text-gray-600 hover:bg-gray-100 border border-gray-200'
              )}
            >
              {n}
            </button>
          )
        )}
        <button
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:bg-gray-100 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}
