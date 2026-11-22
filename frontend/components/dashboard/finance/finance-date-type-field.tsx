"use client";

import {
  FINANCE_DATE_TYPE_OPTIONS,
  type FinanceDateTypeUi
} from "@/components/dashboard/finance/finance-date-type";
import { cn } from "@/lib/utils";

/** Shablon: inline radio qator — fieldset border/siz, teal accent. */
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
    <div
      className={cn(
        "flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2 rounded-xl border border-slate-200/80 bg-white px-3.5 py-2.5",
        className
      )}
      role="radiogroup"
      aria-label="Дата применяется по"
    >
      {FINANCE_DATE_TYPE_OPTIONS.map((option) => {
        const selected = value === option.value;
        return (
          <label
            key={option.value}
            className={cn(
              "flex cursor-pointer items-center gap-2 whitespace-nowrap text-sm transition-colors",
              selected ? "font-semibold text-teal-700" : "font-medium text-slate-600 hover:text-slate-900"
            )}
          >
            <input
              type="radio"
              name="finance-date-type"
              className="h-4 w-4 shrink-0 accent-teal-600"
              checked={selected}
              onChange={() => onChange(option.value)}
            />
            {option.label}
          </label>
        );
      })}
    </div>
  );
}
