"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type PlanningFilterOption = { id: number; name: string };

type Props = {
  label: string;
  emptyLabel: string;
  options: PlanningFilterOption[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  className?: string;
  "aria-label"?: string;
};

/** Multi-checkbox filtr: tanlov bo‘sh bo‘lsa cheklov yo‘q (hammasi). */
export function PlanningFilterDropdown({
  label,
  emptyLabel,
  options,
  selectedIds,
  onChange,
  className,
  "aria-label": ariaLabel
}: Props) {
  const [open, setOpen] = useState(false);

  const buttonText = useMemo(() => {
    if (selectedIds.length === 0) return emptyLabel;
    if (selectedIds.length === 1) {
      return options.find((o) => o.id === selectedIds[0])?.name ?? label;
    }
    return `${selectedIds.length} выбрано`;
  }, [selectedIds, options, emptyLabel, label]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        aria-label={ariaLabel ?? label}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 min-w-[140px] max-w-[200px] items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-700 hover:bg-slate-50"
      >
        <span className="truncate">{buttonText}</span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      </button>
      {open ? (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} aria-hidden />
          <div className="absolute left-0 z-50 mt-1 max-h-64 w-64 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
            <button
              type="button"
              className="flex w-full px-3 py-1.5 text-left text-xs text-teal-700 hover:bg-teal-50"
              onClick={() => onChange([])}
            >
              Сбросить
            </button>
            {options.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400">Нет вариантов</p>
            ) : (
              options.map((o) => {
                const checked = selectedIds.includes(o.id);
                return (
                  <label
                    key={o.id}
                    className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      className="size-3.5 accent-teal-600"
                      checked={checked}
                      onChange={() => {
                        if (checked) onChange(selectedIds.filter((id) => id !== o.id));
                        else onChange([...selectedIds, o.id]);
                      }}
                    />
                    <span className="truncate">{o.name}</span>
                  </label>
                );
              })
            )}
          </div>
        </>
      ) : null}
    </div>
  );
}

type SegmentProps<T extends string> = {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
  "aria-label"?: string;
};

export function PlanningSegmentFilter<T extends string>({
  value,
  onChange,
  options,
  "aria-label": ariaLabel
}: SegmentProps<T>) {
  return (
    <div
      className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white p-0.5"
      role="group"
      aria-label={ariaLabel}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            value === o.value
              ? "bg-teal-600 text-white"
              : "text-slate-600 hover:bg-slate-50"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
