"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

type Props = {
  page: number;
  totalPages: number;
  total: number;
  perPage: number;
  onPageChange: (p: number) => void;
};

export function BalanceDetailPagination({ page, totalPages, total, perPage, onPageChange }: Props) {
  const [jump, setJump] = useState("");

  if (total <= 0) return null;

  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  const handleJump = () => {
    const n = Number.parseInt(jump, 10);
    if (Number.isFinite(n) && n >= 1 && n <= totalPages) onPageChange(n);
    setJump("");
  };

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#e5e7eb] bg-[#fafbfc] px-3 py-2 text-[12px] text-[#666]">
      <span>
        Показано {from}–{to} из {total}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="flex h-7 w-7 items-center justify-center rounded border border-[#d0d5dd] bg-white disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
          let p: number;
          if (totalPages <= 7) p = i + 1;
          else if (page <= 4) p = i + 1;
          else if (page >= totalPages - 3) p = totalPages - 6 + i;
          else p = page - 3 + i;
          return (
            <button
              key={p}
              type="button"
              onClick={() => onPageChange(p)}
              className={`flex h-7 min-w-[28px] items-center justify-center rounded border px-1 text-[12px] ${
                p === page ? "border-[#1aa096] bg-[#1aa096] text-white" : "border-[#d0d5dd] bg-white hover:bg-[#f5f5f5]"
              }`}
            >
              {p}
            </button>
          );
        })}
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="flex h-7 w-7 items-center justify-center rounded border border-[#d0d5dd] bg-white disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="ml-2 text-[#999]">|</span>
        <input
          type="number"
          min={1}
          max={totalPages}
          value={jump}
          onChange={(e) => setJump(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleJump()}
          placeholder="№"
          className="ml-1 h-7 w-12 rounded border border-[#d0d5dd] px-1 text-center text-[12px]"
        />
        <button
          type="button"
          onClick={handleJump}
          className="h-7 rounded border border-[#d0d5dd] bg-white px-2 text-[11px] hover:bg-[#f5f5f5]"
        >
          Перейти
        </button>
      </div>
    </div>
  );
}
