"use client";

export function SalesTablePager({
  total,
  page,
  pageSize,
  onPageChange
}: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIdx = total === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const endIdx = Math.min(total, safePage * pageSize);
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 bg-slate-50/50 px-3 py-2 text-[11px] text-slate-500">
      <span className="tabular-nums">{total === 0 ? "0 записей" : `${startIdx}–${endIdx} из ${total}`}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs hover:bg-slate-50 disabled:opacity-50"
          disabled={safePage <= 1}
          onClick={() => onPageChange(Math.max(1, safePage - 1))}
        >
          Назад
        </button>
        <span className="min-w-[4.25rem] text-center tabular-nums text-slate-800">
          {safePage} / {totalPages}
        </span>
        <button
          type="button"
          className="h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs hover:bg-slate-50 disabled:opacity-50"
          disabled={safePage >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, safePage + 1))}
        >
          Вперёд
        </button>
      </div>
    </div>
  );
}
