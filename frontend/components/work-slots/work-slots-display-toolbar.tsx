"use client";

import { ListOrdered, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { filterSelectClassName } from "@/components/ui/filter-select";
import { cn } from "@/lib/utils";
import type { ViewMode } from "./work-slots-utils";

type Props = {
  search: string;
  onSearchChange: (value: string) => void;
  onSearchApply: () => void;
  pageSize: number;
  allowedPageSizes: readonly number[];
  onPageSizeChange: (n: number) => void;
  viewMode: ViewMode;
  onColumnsClick: () => void;
  selectedCount: number;
  onBulkClick: () => void;
};

const searchClass = cn(
  filterSelectClassName,
  "h-8 w-[11rem] min-w-0 shrink-0 pl-7 text-xs font-normal shadow-sm sm:w-[13rem]"
);

/** Jadval ustidagi panel: qidiruv, sahifa hajmi, ustunlar, guruhli ishlov. */
export function WorkSlotsDisplayToolbar({
  search,
  onSearchChange,
  onSearchApply,
  pageSize,
  allowedPageSizes,
  onPageSizeChange,
  viewMode,
  onColumnsClick,
  selectedCount,
  onBulkClick
}: Props) {
  return (
    <div className="table-toolbar flex flex-wrap items-center gap-2 border-b border-border/80 bg-muted/25 px-3 py-2 sm:px-4">
      <div className="relative shrink-0">
        <Search
          className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground"
          aria-hidden
        />
        <Input
          className={searchClass}
          placeholder="Код / название"
          title="Поиск по коду или названию"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && onSearchApply()}
          aria-label="Поиск по коду или названию"
        />
      </div>

      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="sr-only">Строк на странице</span>
        <select
          className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number.parseInt(e.target.value, 10))}
          aria-label="Строк на странице"
        >
          {allowedPageSizes.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </label>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1 px-2 text-xs"
        title="Управление столбцами"
        disabled={viewMode !== "list"}
        onClick={onColumnsClick}
      >
        <ListOrdered className="size-3.5" aria-hidden />
        Столбцы
      </Button>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="ml-auto h-8 text-xs"
        disabled={selectedCount === 0 || viewMode !== "list"}
        onClick={onBulkClick}
      >
        Групповая обработка
        {selectedCount > 0 ? ` (${selectedCount})` : ""}
      </Button>
    </div>
  );
}
