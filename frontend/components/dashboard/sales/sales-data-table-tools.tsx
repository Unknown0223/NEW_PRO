"use client";

import { cn } from "@/lib/utils";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useEffect, useRef } from "react";

export type SalesTableColumnLike<T> = {
  id: string;
  header: string;
  searchText?: (row: T) => string;
  sortValue?: (row: T) => string | number | null;
};

export type SalesTableSort = { id: string; dir: "asc" | "desc" } | null;

type CellValue = string | number | null;

/** Sort/filtr uchun xom qiymat: `sortValue` → `searchText` → `row[col.id]` (raqamli satr — son). */
export function rawColumnValue<T extends object>(row: T, col: SalesTableColumnLike<T>): CellValue {
  if (col.sortValue) return col.sortValue(row);
  if (col.searchText) return col.searchText(row);
  const v = (row as Record<string, unknown>)[col.id];
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v);
    return v.trim() !== "" && Number.isFinite(n) ? n : v;
  }
  return String(v);
}

export function compareCellValues(a: CellValue, b: CellValue): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), "ru", { numeric: true, sensitivity: "base" });
}

function toNum(s: string): number {
  return Number(s.replace(/\s/g, "").replace(",", "."));
}

/** Son ustunlari: `>1000`, `<=50`, `=0`, `100-500`; aks holda matn bo‘yicha qidiruv. */
export function matchesColumnFilter(value: CellValue, query: string): boolean {
  const q = query.trim();
  if (!q) return true;
  if (typeof value === "number") {
    const compact = q.replace(/\s/g, "");
    const cmp = compact.match(/^(>=|<=|>|<|=)(-?\d+(?:[.,]\d+)?)$/);
    if (cmp) {
      const n = toNum(cmp[2]!);
      switch (cmp[1]) {
        case ">":
          return value > n;
        case "<":
          return value < n;
        case ">=":
          return value >= n;
        case "<=":
          return value <= n;
        default:
          return value === n;
      }
    }
    const range = compact.match(/^(\d+(?:[.,]\d+)?)-(\d+(?:[.,]\d+)?)$/);
    if (range) {
      const lo = toNum(range[1]!);
      const hi = toNum(range[2]!);
      return value >= Math.min(lo, hi) && value <= Math.max(lo, hi);
    }
  }
  return String(value ?? "").toLowerCase().includes(q.toLowerCase());
}

export function SortIndicator({ active, dir }: { active: boolean; dir: "asc" | "desc" }) {
  if (!active) return null;
  const Icon = dir === "asc" ? ArrowUp : ArrowDown;
  return <Icon className="ml-1 inline h-3.5 w-3.5 text-teal-600" aria-hidden />;
}

export function SalesTableSettingsPanel<T>({
  columns,
  hiddenIds,
  sort,
  onToggleColumn,
  onSortChange,
  onReset,
  onClose
}: {
  columns: SalesTableColumnLike<T>[];
  hiddenIds: Set<string>;
  sort: SalesTableSort;
  onToggleColumn: (id: string) => void;
  onSortChange: (sort: SalesTableSort) => void;
  onReset: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  const visibleCount = columns.length - hiddenIds.size;
  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Настройки таблицы"
      className="absolute left-0 top-12 z-30 w-72 rounded-xl border border-border bg-card p-3 shadow-xl"
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Сортировка</p>
      <div className="flex gap-2">
        <select
          value={sort?.id ?? ""}
          onChange={(e) => onSortChange(e.target.value ? { id: e.target.value, dir: sort?.dir ?? "desc" } : null)}
          className="h-9 min-w-0 flex-1 rounded-lg border border-border bg-card px-2 text-sm"
        >
          <option value="">Без сортировки</option>
          {columns.map((c) => (
            <option key={c.id} value={c.id}>
              {c.header}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!sort}
          onClick={() => sort && onSortChange({ id: sort.id, dir: sort.dir === "asc" ? "desc" : "asc" })}
          className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-2 text-xs font-semibold text-slate-700 hover:bg-muted disabled:opacity-40"
          title="Направление"
        >
          {sort?.dir === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
          {sort?.dir === "asc" ? "Возр." : "Убыв."}
        </button>
      </div>

      <p className="mb-2 mt-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Столбцы</p>
      <ul className="max-h-56 space-y-1 overflow-y-auto">
        {columns.map((c) => {
          const checked = !hiddenIds.has(c.id);
          const lockLast = checked && visibleCount <= 1;
          return (
            <li key={c.id}>
              <label
                className={cn(
                  "flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-sm hover:bg-muted",
                  lockLast && "cursor-not-allowed opacity-60"
                )}
              >
                <input
                  type="checkbox"
                  className="size-4 rounded border-input"
                  checked={checked}
                  disabled={lockLast}
                  onChange={() => onToggleColumn(c.id)}
                />
                {c.header}
              </label>
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={onReset}
        className="mt-3 w-full rounded-lg border border-border py-1.5 text-xs font-semibold text-slate-600 hover:bg-muted"
      >
        Сбросить настройки
      </button>
    </div>
  );
}
