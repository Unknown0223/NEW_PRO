"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type FilterSearchableOption = { value: string; label: string; /** Qidiruv: login, kod, id — `label`da ko‘rinmasin */ searchText?: string };

export type FilterSearchableSelectProps = {
  id?: string;
  emptyLabel: string;
  value: string;
  onValueChange: (value: string) => void;
  options: FilterSearchableOption[];
  disabled?: boolean;
  /**
   * false — ro‘yxatda bo‘sh qiymat (emptyLabel) qatori chiqmaydi; triggerda emptyLabel ko‘rinadi.
   * Tanlangan qiymatni boshqa variantga almashtirishda qo‘shimcha qadam bo‘lmasin.
   */
  includeEmptyOption?: boolean;
  /** Serverdan qidiruv: popover ichidagi matn o‘zgarganda chaqiriladi (parent debounce qilishi mumkin). */
  onSearchTextChange?: (text: string) => void;
  /** false — qisqa ro‘yxatlar (masalan 2 ta status) */
  searchable?: boolean;
  searchPlaceholder?: string;
  minPopoverWidth?: number;
  className?: string;
  emptyMessage?: string;
  /** O‘sganda barcha ochiq portal-dropdownlar yopiladi (boshqa filtr panellari bilan to‘qnashmaslik uchun) */
  closeToken?: number;
  onOpenChange?: (open: boolean) => void;
};

export function FilterSearchableSelect({
  id,
  emptyLabel,
  value,
  onValueChange,
  options,
  disabled = false,
  includeEmptyOption = true,
  onSearchTextChange,
  searchable = true,
  searchPlaceholder = "Поиск",
  minPopoverWidth = 280,
  className,
  emptyMessage = "Нет вариантов",
  closeToken,
  onOpenChange
}: FilterSearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [coords, setCoords] = useState({ top: 0, left: 0, width: minPopoverWidth });

  useEffect(() => setMounted(true), []);

  const closeTokRef = useRef<number | undefined>(undefined);
  const setOpenTracked = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setOpen((prev) => {
        const resolved = typeof next === "function" ? (next as (p: boolean) => boolean)(prev) : next;
        // Parent setState (masalan closeToken) setOpen updater ichida chaqirilmasin — React dev xabari.
        if (resolved !== prev) queueMicrotask(() => onOpenChange?.(resolved));
        return resolved;
      });
    },
    [onOpenChange]
  );

  useEffect(() => {
    if (closeToken === undefined) return;
    if (closeTokRef.current === undefined) {
      closeTokRef.current = closeToken;
      return;
    }
    if (closeToken === closeTokRef.current) return;
    closeTokRef.current = closeToken;
    setOpenTracked(false);
  }, [closeToken, setOpenTracked]);

  const selectedLabel = useMemo(() => {
    const v = String(value ?? "").trim();
    if (!v) return "";
    const hit = options.find((o) => o.value === v);
    return String(hit?.label ?? v).trim() || v;
  }, [options, value]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const extra = (o.searchText ?? "").toLowerCase();
      const hay = `${o.label.toLowerCase()} ${extra} ${o.value.toLowerCase()}`;
      return hay.includes(q);
    });
  }, [options, search]);

  const updatePosition = useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    const w = Math.min(Math.max(r.width, minPopoverWidth), vw - 16);
    let left = r.left;
    if (left + w > vw - 8) left = Math.max(8, vw - w - 8);
    setCoords({
      top: r.bottom + 6,
      left,
      width: w
    });
  }, [minPopoverWidth]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(updatePosition) : null;
    if (ro && triggerRef.current) ro.observe(triggerRef.current);
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      ro?.disconnect();
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      const node = e.target as Node;
      if (triggerRef.current?.contains(node)) return;
      if (popRef.current?.contains(node)) return;
      setOpenTracked(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenTracked(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpenTracked]);

  useEffect(() => {
    if (!open) {
      setSearch("");
      onSearchTextChange?.("");
    }
  }, [open, onSearchTextChange]);

  const pick = (v: string) => {
    onValueChange(v);
    setOpenTracked(false);
  };

  const popover = (
    <div
      ref={popRef}
      id={listId}
      role="listbox"
      className="fixed z-[500] flex max-h-[min(55vh,420px)] flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-lg ring-1 ring-black/5 dark:ring-white/10"
      style={{
        top: coords.top,
        left: coords.left,
        width: coords.width
      }}
    >
      {searchable ? (
        <div className="relative shrink-0 border-b border-border/60 px-3 py-2">
          <Search
            className="pointer-events-none absolute left-5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            className="h-9 border-input bg-background pl-9 text-sm shadow-none"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => {
              const t = e.target.value;
              setSearch(t);
              onSearchTextChange?.(t);
            }}
            onMouseDown={(e) => e.stopPropagation()}
            aria-label={searchPlaceholder}
          />
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <ul className="divide-y divide-border/60">
          {includeEmptyOption ? (
            <li role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={value === ""}
                className={cn(
                  "flex w-full items-center px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50",
                  value === "" && "bg-primary/[0.06] font-medium"
                )}
                onClick={() => pick("")}
              >
                {emptyLabel}
              </button>
            </li>
          ) : null}
          {filtered.length === 0 ? (
            <li className="px-3 py-6 text-center text-xs text-muted-foreground">{emptyMessage}</li>
          ) : (
            filtered.map((o) => (
              <li key={o.value || "__empty_row__"} role="presentation">
                <button
                  type="button"
                  role="option"
                  aria-selected={value === o.value}
                  className={cn(
                    "flex w-full items-center px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted/50",
                    value === o.value && "bg-primary/[0.06] font-medium"
                  )}
                  onClick={() => pick(o.value)}
                >
                  <span className="min-w-0 flex-1 truncate">{o.label}</span>
                </button>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );

  return (
    <div className="w-full min-w-0">
      <button
        id={id}
        ref={triggerRef}
        type="button"
        disabled={disabled}
        className={cn(
          "flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-background px-2 text-left text-xs shadow-sm outline-none transition-colors",
          "hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          open && "ring-2 ring-ring ring-offset-2",
          className
        )}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="listbox"
        onClick={() => {
          if (!disabled) setOpenTracked((v) => !v);
        }}
      >
        <span className={cn("min-w-0 flex-1 truncate", !selectedLabel && "text-muted-foreground")}>
          {selectedLabel || emptyLabel}
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {mounted && open ? createPortal(popover, document.body) : null}
    </div>
  );
}
