"use client";

import {
  joinMultiFilterValues,
  pruneToAllowedOptions,
  splitMultiFilterValues
} from "@/lib/client-filter-select-value";
import { cn } from "@/lib/utils";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

export type TemplateSelectOption = { value: string; label: string; /** Qidiruv (login, kod) */ searchText?: string };

type Props = {
  label: string;
  options: TemplateSelectOption[];
  values: string[];
  onChange: (v: string[]) => void;
  /** false = bitta (radio); true = ko‘p (checkbox) */
  multi?: boolean;
  disabled?: boolean;
  /** false — qisqa ro‘yxatlar (masalan 2–3 ta status) */
  searchable?: boolean;
  searchPlaceholder?: string;
  /** Balanslar va boshqa ixcham panellar uchun */
  compact?: boolean;
};

function OptionIndicator({ checked, multi }: { checked: boolean; multi: boolean }) {
  if (multi) {
    return (
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
          checked ? "border-emerald-500 bg-emerald-500" : "border-border bg-card"
        )}
      >
        {checked ? <Check className="h-3 w-3 text-white" strokeWidth={3} /> : null}
      </span>
    );
  }
  return (
    <span
      className={cn(
        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border bg-card",
        checked ? "border-emerald-500" : "border-border"
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
  disabled = false,
  searchable: searchableProp,
  searchPlaceholder,
  compact = false
}: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const searchable = searchableProp ?? options.length > 3;
  const searchPh = searchPlaceholder ?? `Поиск: ${label}`;

  const allowed = useMemo(() => new Set(options.map((o) => o.value)), [options]);

  const filteredOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!searchable || !q) return options;
    return options.filter((o) => {
      const hay = `${o.label} ${o.searchText ?? ""} ${o.value}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, search, searchable]);

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
  const visibleValues = useMemo(() => filteredOptions.map((o) => o.value), [filteredOptions]);
  const allSelected =
    multi && visibleValues.length > 0 && visibleValues.every((v) => normalizedValues.includes(v));
  const someSelected =
    multi && visibleValues.some((v) => normalizedValues.includes(v)) && !allSelected;

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (!open) {
      setSearch("");
      return;
    }
    if (searchable) {
      const t = window.setTimeout(() => searchInputRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
  }, [open, searchable]);

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
    if (allSelected) {
      emit(normalizedValues.filter((v) => !visibleValues.includes(v)));
      return;
    }
    emit([...new Set([...normalizedValues, ...visibleValues])]);
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
          "relative flex w-full items-center justify-between gap-1 border bg-card text-left transition-colors focus:outline-none",
          compact ? "h-[32px] rounded-md px-2" : "h-[38px] rounded-lg px-3",
          disabled && "cursor-not-allowed opacity-60",
          open ? "border-emerald-400 ring-1 ring-emerald-200" : "border-border hover:border-border"
        )}
      >
        <span
          className={cn(
            "pointer-events-none absolute bg-card leading-none transition-all duration-200 font-medium text-gray-600",
            hasValue
              ? compact
                ? "left-1.5 top-0 -translate-y-1/2 px-0.5 text-[10px]"
                : "left-2 top-0 -translate-y-1/2 px-1 text-[11px]"
              : compact
                ? "left-2 top-1/2 -translate-y-1/2 text-[11px]"
                : "left-3 top-1/2 -translate-y-1/2 text-[13px]"
          )}
        >
          {label}
        </span>
        {displayText ? (
          <span
            className={cn(
              "ml-0.5 min-w-0 flex-1 truncate font-medium text-gray-900",
              compact ? "pt-px text-[11px]" : "ml-1 pt-0.5 text-[13px]"
            )}
          >
            {displayText}
          </span>
        ) : (
          <span className="flex-1" />
        )}
        <div className="flex shrink-0 items-center gap-0.5">
          {hasValue ? (
            <span
              role="button"
              tabIndex={-1}
              onClick={clearAll}
              className="flex h-4 w-4 cursor-pointer items-center justify-center rounded-full hover:bg-muted"
            >
              <X className="h-3 w-3 text-gray-500" />
            </span>
          ) : null}
          <ChevronDown
            className={cn(
              "text-gray-500 transition-transform duration-150",
              compact ? "h-3 w-3" : "h-3.5 w-3.5",
              open && "rotate-180"
            )}
          />
        </div>
      </button>

      {open ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 min-w-[220px] overflow-hidden rounded-lg border border-border bg-card shadow-xl">
          {searchable ? (
            <div className="relative border-b border-border px-2 py-2">
              <Search
                className="pointer-events-none absolute left-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400"
                aria-hidden
              />
              <input
                ref={searchInputRef}
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onMouseDown={(e) => e.stopPropagation()}
                placeholder={searchPh}
                className="h-8 w-full rounded-md border border-border bg-card pl-8 pr-2 text-[13px] text-gray-900 outline-none focus:border-emerald-400 focus:ring-1 focus:ring-emerald-200"
                aria-label={searchPh}
              />
            </div>
          ) : null}
          {multi && filteredOptions.length > 0 ? (
            <button
              type="button"
              onClick={toggleAll}
              className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-[13px] font-medium text-gray-800 transition-colors hover:bg-muted"
            >
              <OptionIndicator checked={allSelected} multi />
              <span className={cn("font-medium", someSelected && "text-emerald-700")}>
                {search.trim() ? "Выбрать все (по поиску)" : "Выбрать все"}
              </span>
            </button>
          ) : null}
          <div className="scrollbar-none max-h-56 overflow-y-auto py-1">
            {options.length === 0 ? (
              <div className="px-3 py-2 text-[13px] text-gray-600">Нет данных</div>
            ) : filteredOptions.length === 0 ? (
              <div className="px-3 py-4 text-center text-[13px] text-gray-500">Ничего не найдено</div>
            ) : (
              filteredOptions.map((opt) => {
                const checked = normalizedValues.includes(opt.value);
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => toggle(opt.value)}
                    className={cn(
                      "flex w-full items-center gap-2 px-3 py-2 text-[13px] text-gray-800 transition-colors hover:bg-muted",
                      checked && "bg-emerald-50/50"
                    )}
                  >
                    <OptionIndicator checked={checked} multi={multi} />
                    <span className={cn("truncate text-left", checked && "font-semibold text-emerald-800")}>
                      {opt.label}
                    </span>
                  </button>
                );
              })
            )}
          </div>
          {searchable && options.length > 0 ? (
            <div className="border-t border-border px-3 py-1.5 text-[10px] text-gray-500">
              {filteredOptions.length} из {options.length}
              {search.trim() ? " (по поиску)" : ""}
            </div>
          ) : null}
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
