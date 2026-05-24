"use client";

import type { SalesDateType } from "@/components/dashboard/sales/types";
import { cn } from "@/lib/utils";

const SALES_DATE_TYPE_OPTIONS: Array<{ value: SalesDateType; label: string }> = [
  { value: "order_date", label: "Дата заявки" },
  { value: "shipment_date", label: "Дата отгрузки" }
];

export function SalesDateTypeFieldset({
  value,
  onChange,
  className
}: {
  value: SalesDateType;
  onChange: (next: SalesDateType) => void;
  className?: string;
}) {
  return (
    <fieldset
      className={cn("min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2", className)}
    >
      <legend className="px-1 text-xs font-medium text-slate-500">Дата применяется по</legend>
      <div
        className="flex flex-wrap items-center gap-x-4 gap-y-2"
        role="radiogroup"
        aria-label="Дата применяется по"
      >
        {SALES_DATE_TYPE_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-sm text-slate-700"
          >
            <input
              type="radio"
              name="sales-date-type"
              className="h-4 w-4 shrink-0 accent-teal-600"
              checked={value === option.value}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
