"use client";

import { cn } from "@/lib/utils";

/** Jadval ustuni «Требовать Face ID» — Вкл/выкл. */
export function StaffRequireFaceLoginToggle({
  checked,
  disabled,
  warnNoReference,
  onChange
}: {
  checked: boolean;
  disabled?: boolean;
  /** Yoqilganda etalon rasm yo‘q — ogohlantirish */
  warnNoReference?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label="Требовать Face ID"
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className="inline-flex items-center disabled:cursor-not-allowed"
      >
        <span
          className={cn(
            "relative h-5 w-9 rounded-full transition",
            checked ? "bg-teal-500" : "bg-muted",
            disabled && "opacity-60"
          )}
        >
          <span
            className={cn(
              "absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-card shadow transition-transform",
              checked && "translate-x-4"
            )}
          />
        </span>
        <span className="ml-2 text-xs text-slate-600">{checked ? "Вкл" : "Выкл"}</span>
      </button>
      {checked && warnNoReference ? (
        <span className="text-[10px] leading-tight text-amber-700">Нужен эталон Face ID</span>
      ) : null}
    </div>
  );
}
