"use client";

import { Input } from "@/components/ui/input";
import {
  formatPriceDraftDisplay,
  isAllowedPriceInput,
  parsePriceDraft,
  sanitizePriceInput
} from "@/lib/price-matrix-draft";
import { formatGroupedInteger } from "@/lib/format-numbers";
import type { PriceMatrixRow } from "./price-matrix-types";

type Props = {
  rows: PriceMatrixRow[];
  currency: string;
  draft: Record<number, string>;
  onDraftChange: (productId: number, value: string) => void;
  isLoading: boolean;
  needsFilters: boolean;
  needsCategories?: boolean;
  showCategoryColumn?: boolean;
  disabled?: boolean;
};

export function PriceMatrixTable({
  rows,
  currency,
  draft,
  onDraftChange,
  isLoading,
  needsFilters,
  needsCategories,
  showCategoryColumn,
  disabled
}: Props) {
  const colSpan = showCategoryColumn ? 5 : 4;
  return (
    <div className="overflow-hidden rounded-lg border bg-card">
      <table className="w-full text-sm">
        <thead className="app-table-thead text-left">
          <tr>
            <th className="px-3 py-2 font-medium">№</th>
            {showCategoryColumn ? (
              <th className="px-3 py-2 font-medium">Категория</th>
            ) : null}
            <th className="px-3 py-2 font-medium">Название</th>
            <th className="px-3 py-2 font-medium">SKU</th>
            <th className="px-3 py-2 font-medium">Сумма ({currency})</th>
          </tr>
        </thead>
        <tbody>
          {isLoading ? (
            <tr>
              <td colSpan={colSpan} className="px-3 py-6 text-muted-foreground">
                Загрузка…
              </td>
            </tr>
          ) : needsFilters ? (
            <tr>
              <td colSpan={colSpan} className="px-3 py-6 text-center text-muted-foreground">
                Narx turini tanlang.
              </td>
            </tr>
          ) : needsCategories ? (
            <tr>
              <td colSpan={colSpan} className="px-3 py-6 text-center text-muted-foreground">
                Kamida bitta kategoriya tanlang.
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="px-3 py-6 text-center text-muted-foreground">
                Tanlangan kategoriyalarda mahsulot yo‘q.
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr key={r.product_id} className="border-t">
                <td className="px-3 py-2 tabular-nums">{formatGroupedInteger(i + 1)}</td>
                {showCategoryColumn ? (
                  <td className="max-w-[10rem] truncate px-3 py-2 text-muted-foreground" title={r.category_name ?? ""}>
                    {r.category_name ?? "—"}
                  </td>
                ) : null}
                <td className="px-3 py-2">{r.name}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.sku}</td>
                <td className="px-3 py-2">
                  <Input
                    className="h-9 min-w-[9rem] max-w-[12rem] font-mono text-sm tabular-nums"
                    value={draft[r.product_id] ?? ""}
                    disabled={disabled}
                    inputMode="decimal"
                    maxLength={16}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!isAllowedPriceInput(v)) return;
                      onDraftChange(r.product_id, sanitizePriceInput(v));
                    }}
                    onBlur={() => {
                      const raw = draft[r.product_id] ?? "";
                      if (raw.trim() === "") return;
                      const parsed = parsePriceDraft(raw);
                      if (parsed.ok) {
                        onDraftChange(r.product_id, formatPriceDraftDisplay(parsed.value));
                      }
                    }}
                  />
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
