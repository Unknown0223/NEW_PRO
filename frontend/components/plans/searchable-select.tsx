"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type SelectOption = { id: number; name: string };

type Props = {
  value: number | null;
  options: SelectOption[];
  onChange: (id: number) => void;
  nameOf: (id: number) => string;
  disabled?: boolean;
  placeholder?: string;
  /** Tugma (trigger) uchun qo'shimcha klasslar. */
  triggerClassName?: string;
  /** Menyu o'ngga yoki chapga tekislansinmi. */
  align?: "left" | "right";
  /** Menyu eni (px). */
  menuWidth?: number;
};

/** Qidiruvli, ochiladigan tanlov (native select o'rniga) — teal uslubda. */
export function SearchableSelect({
  value,
  options,
  onChange,
  nameOf,
  disabled,
  placeholder = "Выберите…",
  triggerClassName,
  align = "left",
  menuWidth
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      clearTimeout(t);
    };
  }, [open]);

  const RESULT_LIMIT = 200;
  const { filtered, total } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = q ? options.filter((o) => o.name.toLowerCase().includes(q)) : options;
    return { filtered: all.slice(0, RESULT_LIMIT), total: all.length };
  }, [options, query]);

  const hasValue = value != null;
  const label = hasValue ? nameOf(value as number) : placeholder;

  return (
    <div ref={rootRef} className="relative w-full">
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (disabled) return;
          setQuery("");
          setOpen((v) => !v);
        }}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-1 rounded-lg border px-2.5 text-xs outline-none transition-colors",
          "disabled:cursor-not-allowed disabled:bg-muted/40 disabled:text-muted-foreground",
          hasValue
            ? "border-teal-500/70 bg-teal-50 text-teal-700 dark:bg-teal-500/10 dark:text-teal-300"
            : "border-dashed border-muted-foreground/40 text-muted-foreground hover:border-teal-500/60",
          triggerClassName
        )}
        title={hasValue ? label : undefined}
      >
        <span className="truncate text-left">{label}</span>
        <ChevronDown className={cn("size-3.5 shrink-0 opacity-60", hasValue && "opacity-80")} />
      </button>

      {open && !disabled && (
        <div
          className={cn(
            "absolute z-[60] mt-1 overflow-hidden rounded-lg border border-border bg-popover shadow-xl",
            align === "right" ? "right-0" : "left-0"
          )}
          style={{ width: menuWidth ?? "max(100%, 240px)", minWidth: "100%" }}
        >
          <div className="flex items-center gap-1.5 border-b border-border px-2.5 py-1.5">
            <Search className="size-3.5 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск…"
              className="h-6 w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <div className="px-2.5 py-3 text-center text-xs text-muted-foreground">Ничего не найдено</div>
            ) : (
              filtered.map((o) => {
                const selected = o.id === value;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => {
                      onChange(o.id);
                      setOpen(false);
                    }}
                    className={cn(
                      "block w-full truncate rounded-md px-2.5 py-1.5 text-left text-xs transition-colors",
                      selected
                        ? "bg-teal-50 font-semibold text-teal-700 dark:bg-teal-500/15 dark:text-teal-300"
                        : "text-foreground hover:bg-accent"
                    )}
                    title={o.name}
                  >
                    {o.name}
                  </button>
                );
              })
            )}
            {total > filtered.length && (
              <div className="px-2.5 py-1.5 text-center text-[11px] text-muted-foreground">
                Показано {filtered.length} из {total}. Уточните поиск…
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
