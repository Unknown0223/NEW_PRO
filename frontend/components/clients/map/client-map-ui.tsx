"use client";

import { cn } from "@/lib/utils";
import { Check, ChevronDown, Minus, RotateCcw, Search, X } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";

export function ClientMapPanelHeader({
  open,
  title,
  onClick
}: {
  open: boolean;
  title: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-[52px] w-full items-center gap-2 border-b border-border px-4 text-left text-sm transition hover:bg-muted"
    >
      {open ? (
        <Minus size={14} className="text-[#1c9a9a]" />
      ) : (
        <span className="w-3 text-center text-lg leading-none text-slate-500">+</span>
      )}
      <span className={open ? "font-semibold text-[#168f8f]" : "font-semibold text-slate-700"}>{title}</span>
      {open ? <span className="ml-auto h-1 w-1 rounded-full bg-[#168f8f]" /> : null}
    </button>
  );
}

export function ClientMapButtonGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-[#35516a]">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export function ClientMapChoiceButton({
  active,
  onClick,
  children
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "h-8 rounded-md bg-[#009999] px-3 text-xs font-semibold text-white shadow-sm"
          : "h-8 rounded-md border border-border bg-card px-3 text-xs font-semibold text-[#26384a] transition hover:border-[#009999] hover:text-[#009999]"
      }
    >
      {children}
    </button>
  );
}

export function ClientMapSearchableMultiSelect({
  label,
  placeholder,
  searchPlaceholder,
  values,
  options,
  onChange
}: {
  label: string;
  placeholder: string;
  searchPlaceholder: string;
  values: string[];
  options: { value: string; label: string }[];
  onChange: (values: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filteredOptions = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return options;
    return options.filter((option) => option.label.toLowerCase().includes(normalized));
  }, [options, query]);

  const title = values.length === 0 ? placeholder : `${placeholder}: ${values.length}`;

  const toggle = (value: string) => {
    onChange(values.includes(value) ? values.filter((item) => item !== value) : [...values, value]);
  };

  return (
    <div className="space-y-2">
      <div className="text-xs font-medium text-[#35516a]">{label}</div>
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex h-10 w-full items-center justify-between rounded-lg border border-border bg-card px-3 text-left text-sm text-slate-700 transition hover:border-[#009999]"
      >
        <span className={values.length ? "font-medium text-slate-800" : "text-slate-500"}>{title}</span>
        <ChevronDown
          size={16}
          className={open ? "rotate-180 text-[#009999] transition" : "text-slate-400 transition"}
        />
      </button>

      {values.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {values.slice(0, 4).map((value) => {
            const lbl = options.find((o) => o.value === value)?.label ?? value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => toggle(value)}
                className="inline-flex h-6 items-center gap-1 rounded-md bg-[#e7f7f7] px-2 text-[11px] font-medium text-[#087a7a]"
              >
                <span className="max-w-[110px] truncate">{lbl}</span>
                <X size={12} />
              </button>
            );
          })}
          {values.length > 4 ? (
            <span className="inline-flex h-6 items-center rounded-md bg-muted px-2 text-[11px] font-medium text-slate-500">
              +{values.length - 4}
            </span>
          ) : null}
        </div>
      ) : null}

      {open ? (
        <div className="rounded-lg border border-border bg-card p-2 shadow-sm">
          <div className="mb-2 flex h-8 items-center gap-2 rounded-md border border-border px-2">
            <Search size={14} className="text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={searchPlaceholder}
              className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-slate-400"
            />
          </div>

          <div className="mb-2 flex gap-2">
            <button
              type="button"
              onClick={() => onChange(options.map((option) => option.value))}
              className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-[#009999] hover:text-[#009999]"
            >
              Все
            </button>
            <button
              type="button"
              onClick={() => onChange([])}
              className="rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-slate-600 hover:border-[#009999] hover:text-[#009999]"
            >
              Очистить
            </button>
          </div>

          <div className="client-map-filter-scroll max-h-40 overflow-y-auto pr-1">
            {filteredOptions.length === 0 ? (
              <div className="px-2 py-3 text-xs text-slate-400">Ничего не найдено</div>
            ) : (
              filteredOptions.map((option) => {
                const active = values.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggle(option.value)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition hover:bg-muted"
                  >
                    <span
                      className={cn(
                        "flex h-4 w-4 items-center justify-center rounded border",
                        active ? "border-[#009999] bg-[#009999] text-white" : "border-border bg-card"
                      )}
                    >
                      {active ? <Check size={12} /> : null}
                    </span>
                    <span className={active ? "font-semibold text-slate-900" : "text-slate-700"}>
                      {option.label}
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

export function ClientMapFilterActions({
  onApply,
  onReset
}: {
  onApply: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex gap-2 pt-1">
      <button
        type="button"
        onClick={onApply}
        className="h-10 flex-1 rounded-lg bg-[#2b9f9b] text-sm font-semibold text-white transition hover:bg-[#248b88]"
      >
        Применить
      </button>
      <button
        type="button"
        onClick={onReset}
        title="Сбросить фильтры"
        className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#9bd7d5] text-white transition hover:bg-[#83cac8]"
      >
        <RotateCcw size={16} />
      </button>
    </div>
  );
}
