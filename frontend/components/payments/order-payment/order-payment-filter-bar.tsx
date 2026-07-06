"use client";

import { Button } from "@/components/ui/button";
import { FilterSelect } from "@/components/ui/filter-select";
import { Label } from "@/components/ui/label";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import type { OrderPaymentFilters } from "./types";

type CashDeskOpt = { id: number; name: string };

type Props = {
  filters: OrderPaymentFilters;
  onChange: (filters: OrderPaymentFilters) => void;
  cashDesks: CashDeskOpt[];
  onSuccessCount: number;
  totalCount: number;
  onSave: () => void;
  saving?: boolean;
  saveDisabled?: boolean;
};

function shiftLocalDateTime(local: string, days: number): string {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) return local;
  d.setDate(d.getDate() + days);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function OrderPaymentFilterBar({
  filters,
  onChange,
  cashDesks,
  onSuccessCount,
  totalCount,
  onSave,
  saving,
  saveDisabled
}: Props) {
  const progress = totalCount === 0 ? 0 : Math.round((onSuccessCount / totalCount) * 100);

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-4">
        <div className="relative flex h-9 w-full items-center justify-center overflow-hidden rounded-md border border-teal-200/80 bg-gradient-to-r from-emerald-50 to-teal-50 text-sm font-medium text-teal-800 dark:border-teal-900 dark:from-emerald-950/40 dark:to-teal-950/40 dark:text-teal-200">
          <div
            className="absolute inset-y-0 left-0 rounded-md bg-gradient-to-r from-emerald-400 to-teal-500 transition-all"
            style={{ width: `${progress}%` }}
          />
          <span className="relative z-10">
            Успешно {onSuccessCount} из {totalCount} ({progress}%)
          </span>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={filters.errorOnly}
            onChange={(e) => onChange({ ...filters, errorOnly: e.target.checked })}
            className="size-4 rounded border-input"
          />
          Показать только ошибочные платежи
        </label>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          data-testid="new-payment-submit"
          disabled={saving || saveDisabled}
          onClick={onSave}
          className="min-w-[10rem]"
        >
          {saving ? "Сохранение…" : "Сохранить платежи"}
        </Button>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
            <Calendar className="size-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Дата</span>
            <button
              type="button"
              className="rounded p-1 hover:bg-muted"
              aria-label="Предыдущий день"
              onClick={() =>
                onChange({ ...filters, paidAtLocal: shiftLocalDateTime(filters.paidAtLocal, -1) })
              }
            >
              <ChevronLeft className="size-4" />
            </button>
            <input
              type="datetime-local"
              value={filters.paidAtLocal}
              onChange={(e) => onChange({ ...filters, paidAtLocal: e.target.value })}
              className="border-0 bg-transparent text-sm focus:ring-0"
            />
            <button
              type="button"
              className="rounded p-1 hover:bg-muted"
              aria-label="Следующий день"
              onClick={() =>
                onChange({ ...filters, paidAtLocal: shiftLocalDateTime(filters.paidAtLocal, 1) })
              }
            >
              <ChevronRight className="size-4" />
            </button>
          </div>

          <div className="space-y-1">
            <Label className="sr-only">Касса</Label>
            <FilterSelect
              className="flex h-10 min-w-[10rem] rounded-md border border-input bg-background px-2 text-sm"
              emptyLabel="Все кассы"
              value={filters.cashDeskId}
              onChange={(e) => onChange({ ...filters, cashDeskId: e.target.value })}
            >
              {cashDesks.map((d) => (
                <option key={d.id} value={String(d.id)}>
                  {d.name}
                </option>
              ))}
            </FilterSelect>
          </div>
        </div>
      </div>
    </div>
  );
}
