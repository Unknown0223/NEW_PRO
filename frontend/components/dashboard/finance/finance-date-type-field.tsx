"use client";

import {
  FINANCE_DATE_TYPE_OPTIONS,
  type FinanceDateTypeUi
} from "@/components/dashboard/finance/finance-date-type";
import { cn } from "@/lib/utils";

/** Shablon: `fieldset` + 4 radio, `sm:flex sm:flex-wrap`. */
export function FinanceDateTypeFieldset({
  value,
  onChange,
  className
}: {
  value: FinanceDateTypeUi;
  onChange: (next: FinanceDateTypeUi) => void;
  className?: string;
}) {
  return (
    <fieldset
      className={cn("min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-2", className)}
    >
      <legend className="px-1 text-xs font-medium text-slate-500">Дата применяется по</legend>
      <div
        className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap"
        role="radiogroup"
        aria-label="Дата применяется по"
      >
        {FINANCE_DATE_TYPE_OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-2 whitespace-nowrap text-sm text-slate-700"
          >
            <input
              type="radio"
              name="finance-date-type"
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
