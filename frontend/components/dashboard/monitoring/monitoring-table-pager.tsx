"use client";

import { TABLE_PAGE_SIZES } from "@/components/dashboard/monitoring/table-constants";
import { Button } from "@/components/ui/button";

export function MonitoringTablePager({
  total,
  page,
  pageSize,
  onPageChange,
  onPageSizeChange
}: {
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (p: number) => void;
  onPageSizeChange: (s: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(Math.max(0, total) / pageSize));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const start = total === 0 ? 0 : safePage * pageSize + 1;
  const end = Math.min(total, (safePage + 1) * pageSize);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-muted/10 px-2 py-2 text-[11px] text-muted-foreground">
      <span className="tabular-nums">
        {total === 0 ? "0 записей" : `${start}–${end} из ${total}`}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-1.5">
          <span className="shrink-0 text-muted-foreground">На странице</span>
          <select
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground shadow-sm"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number.parseInt(e.target.value, 10) || 10)}
          >
            {TABLE_PAGE_SIZES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs"
            disabled={safePage <= 0}
            onClick={() => onPageChange(safePage - 1)}
          >
            Назад
          </Button>
          <span className="min-w-[4.25rem] text-center tabular-nums text-foreground">
            {safePage + 1} / {totalPages}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 px-2.5 text-xs"
            disabled={safePage >= totalPages - 1}
            onClick={() => onPageChange(safePage + 1)}
          >
            Вперёд
          </Button>
        </div>
      </div>
    </div>
  );
}
