"use client";

import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Option = { value: string; label: string; active?: boolean };

type Props = {
  value: string;
  onChange: (v: string) => void;
  options: Option[];
  placeholder?: string;
};

function normalizeOptions(options: Option[]): Option[] {
  return options
    .filter((o) => o != null && String(o.value ?? "").trim().length > 0)
    .map((o) => ({
      ...o,
      value: String(o.value).trim(),
      label: (o.label ?? o.value ?? "").trim() || String(o.value).trim()
    }));
}

export function SearchableSelect({ value, onChange, options, placeholder }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  const safeOptions = useMemo(() => normalizeOptions(options), [options]);

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const searchLower = search.toLowerCase();
  const filtered = safeOptions.filter((o) => o.label.toLowerCase().includes(searchLower));
  const selectedLabel = safeOptions.find((o) => o.value === value)?.label ?? "";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex w-full items-center justify-between rounded-lg border bg-card px-3 py-2 text-left text-sm transition-colors",
          open ? "border-teal-500 ring-1 ring-teal-200" : "border-border"
        )}
      >
        <span className={cn(selectedLabel ? "text-slate-900" : "text-slate-400")}>
          {selectedLabel || placeholder || "—"}
        </span>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-lg">
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Поиск"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-md border border-border bg-card py-1.5 pl-8 pr-3 text-sm focus:border-teal-500 focus:outline-none"
                autoFocus
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-center text-sm text-slate-400">Не найдено</div>
            ) : (
              filtered.map((o) => (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={cn(
                    "flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted",
                    value === o.value && "bg-teal-50 font-medium text-teal-700"
                  )}
                >
                  <span>{o.label}</span>
                  {o.active ? <span className="h-2 w-2 rounded-full bg-teal-500" /> : null}
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
