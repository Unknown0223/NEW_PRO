"use client";

import {
  joinMultiFilterValues,
  pruneToAllowedOptions,
  splitMultiFilterValues
} from "@/lib/client-filter-select-value";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export type TemplateSelectOption = { value: string; label: string };

type Props = {
  label: string;
  options: TemplateSelectOption[];
  values: string[];
  onChange: (v: string[]) => void;
  /** false = bitta (radio); true = ko‘p (checkbox) */
  multi?: boolean;
  disabled?: boolean;
};

function OptionIndicator({ checked, multi }: { checked: boolean; multi: boolean }) {
  if (multi) {
    return (
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
          checked ? "border-emerald-500 bg-emerald-500" : "border-gray-300 bg-white"
        )}
      >
        {checked ? <Check className="h-3 w-3 text-white" strokeWidth={3} /> : null}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border bg-white",
        checked ? "border-emerald-500" : "border-gray-300"
      )}
    >
      {checked ? <span className="h-2 w-2 rounded-full bg-emerald-500" /> : null}
    </span>
  );
}

export function ClientsTemplateSelectField({
  label,
  options,
  values,
  onChange,
  multi = false,
  disabled = false
}: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const allowed = useMemo(() => new Set(options.map((o) => o.value)), [options]);

  const normalizedValues = useMemo(() => {
    const raw = multi ? values : values.slice(0, 1);
    return pruneToAllowedOptions(raw, allowed);
  }, [values, multi, allowed]);

  useEffect(() => {
    const same =
      normalizedValues.length === values.length &&
      normalizedValues.every((v, i) => v === values[i]);
    if (!same) onChange(normalizedValues);
  }, [normalizedValues, values, onChange]);

  const hasValue = normalizedValues.length > 0;
  const allSelected = multi && options.length > 0 && normalizedValues.length === options.length;
  const someSelected = multi && normalizedValues.length > 0 && !allSelected;

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const emit = (next: string[]) => {
    const cleaned = multi ? pruneToAllowedOptions(next, allowed) : pruneToAllowedOptions(next.slice(0, 1), allowed);
    onChange(cleaned);
  };

  const toggle = (val: string) => {
    if (!allowed.has(val)) return;
    if (multi) {
      emit(
        normalizedValues.includes(val)
          ? normalizedValues.filter((v) => v !== val)
          : [...normalizedValues, val]
      );
      return;
    }
    emit(normalizedValues.includes(val) ? [] : [val]);
    setOpen(false);
  };

  const toggleAll = () => {
    if (!multi) return;
    emit(allSelected ? [] : options.map((o) => o.value));
  };

  const clearAll = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    emit([]);
  };

  const displayText = multi
    ? normalizedValues.length === 0
      ? ""
      : `${options.find((o) => o.value === normalizedValues[0])?.label ?? normalizedValues[0]}${
          normalizedValues.length > 1 ? ` (+${normalizedValues.length - 1})` : ""
        }`
    : (options.find((o) => o.value === normalizedValues[0])?.label ?? "");

  return (
    <div ref={ref} className="relative w-full min-w-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={cn(
          "relative flex h-[38px] w-full items-center justify-between gap-1 rounded-lg border bg-white px-3 text-left transition-colors focus:outline-none",
          disabled && "cursor-not-allowed opacity-60",
          open ? "border-emerald-400 ring-1 ring-emerald-200" : "border-gray-200 hover:border-gray-300"
        )}
      >
        <span
          className={cn(
            "pointer-events-none absolute bg-white leading-none transition-all duration-200",
            hasValue
              ? "left-2 top-0 -translate-y-1/2 px-1 text-[10px] text-gray-400"
              : "left-3 top-1/2 -translate-y-1/2 text-[13px] text-gray-400"
          )}
        >
          {label}
        </span>
        {displayText ? (
          <span className="ml-1 min-w-0 flex-1 truncate pt-0.5 text-[13px] text-gray-800">{displayText}</span>
        ) : (
          <span className="flex-1" />
        )}
        <div className="flex shrink-0 items-center gap-0.5">
          {hasValue ? (
            <span
              role="button"
              tabIndex={-1}
              onClick={clearAll}
              className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full hover:bg-gray-100"
            >
              <X className="h-3 w-3 text-gray-400" />
            </span>
          ) : null}
          <ChevronDown
            className={cn("h-3.5 w-3.5 text-gray-400 transition-transform duration-150", open && "rotate-180")}
          />
        </div>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 min-w-[180px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-xl">
          {multi && options.length > 1 ? (
            <button
              type="button"
              onClick={toggleAll}
              className="flex w-full items-center gap-2 border-b border-gray-100 px-3 py-2 text-[13px] text-gray-600 transition-colors hover:bg-gray-50"
            >
              <OptionIndicator checked={allSelected} multi />
              <span className={cn("font-medium", someSelected && "text-emerald-700")}>Выбрать все</span>
            </button>
          ) : null}
          <div className="scrollbar-none max-h-48 overflow-y-auto py-1">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-[13px] text-gray-400">Нет данных</div>
            ) : (
              options.map((opt) => {
                const checked = normalizedValues.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggle(opt.value)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-[13px] transition-colors hover:bg-gray-50",
                      checked && "bg-emerald-50/50"
                    )}
                  >
                    <OptionIndicator checked={checked} multi={multi} />
                    <span className={cn("truncate text-left", checked && "font-medium text-emerald-700")}>
                      {opt.label}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

/** @deprecated — `client-filter-select-value.ts` dan foydalaning */
export function csvFromValues(vals: string[]): string {
  return joinMultiFilterValues(vals);
}

/** @deprecated — `splitMultiFilterValues` */
export function valuesFromCsv(raw: string): string[] {
  return splitMultiFilterValues(raw);
}
