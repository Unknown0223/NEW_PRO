"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export function AutomationPagination({
  currentPage,
  totalPages,
  totalItems,
  itemsPerPage,
  onPageChange,
  onItemsPerPageChange
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
  onPageChange: (page: number) => void;
  onItemsPerPageChange: (items: number) => void;
}) {
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1;
  const endItem = Math.min(currentPage * itemsPerPage, totalItems);

  const pageButtons = (() => {
    const max = 7;
    if (totalPages <= max) return Array.from({ length: totalPages }, (_, i) => i + 1);
    const pages: number[] = [];
    let start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, start + max - 1);
    start = Math.max(1, end - max + 1);
    for (let p = start; p <= end; p++) pages.push(p);
    return pages;
  })();

  return (
    <div className="flex items-center justify-between border-t border-border bg-card px-4 py-3">
      <div className="text-sm text-gray-500">
        Показано{" "}
        <span className="font-medium text-gray-700">
          {startItem} - {endItem}
        </span>{" "}
        / {totalItems}
      </div>
      <div className="flex items-center gap-2">
        <select
          value={itemsPerPage}
          onChange={(e) => onItemsPerPageChange(Number(e.target.value))}
          className="cursor-pointer rounded-lg border border-border px-2 py-1 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          <option value={10}>10</option>
          <option value={25}>25</option>
          <option value={50}>50</option>
          <option value={100}>100</option>
        </select>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-muted hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronLeft size={16} />
          </button>
          {pageButtons.map((page) => (
            <button
              key={page}
              type="button"
              onClick={() => onPageChange(page)}
              className={`h-7 min-w-[28px] rounded-lg px-1.5 text-sm transition-colors ${
                page === currentPage ? "bg-teal-600 text-white" : "text-gray-600 hover:bg-muted"
              }`}
            >
              {page}
            </button>
          ))}
          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-muted hover:text-gray-600 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
