"use client";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ChevronDown, Search } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

export type PickOption = {
  value: string;
  label: string;
  subtitle?: string;
  color?: string;
  /** Qidiruvda hisobga olinadigan qo'shimcha matn (login, telefon va h.k.) */
  searchText?: string;
};

function avatarText(o: PickOption): string {
  return (o.label.trim()[0] ?? "?").toUpperCase();
}

/**
 * Qidiruvli, scrollli tanlash ro'yxati (ichki qism). Agent/dastavchik kabi
 * ro'yxat juda katta bo'lganda ham ixcham qoladi: qidiruv + maks balandlik + scroll.
 */
export function SearchablePickList({
  options,
  selected,
  onToggle,
  single = false,
  searchPlaceholder = "Qidirish…",
  emptyMessage = "Hech narsa topilmadi",
  maxHeightClass = "max-h-[min(48vh,360px)]",
  autoFocus = true,
  showAvatar = true
}: {
  options: PickOption[];
  selected: Set<string>;
  onToggle: (value: string) => void;
  single?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  maxHeightClass?: string;
  autoFocus?: boolean;
  showAvatar?: boolean;
}) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => {
      const hay = `${o.label} ${o.subtitle ?? ""} ${o.searchText ?? ""} ${o.value}`.toLowerCase();
      return hay.includes(q);
    });
  }, [options, search]);

  return (
    <div className="flex min-h-0 flex-col">
      <div className="relative shrink-0 px-1 pb-2">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
        <Input
          autoFocus={autoFocus}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          className="h-9 pl-9 text-sm"
          onMouseDown={(e) => e.stopPropagation()}
        />
      </div>
      <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5", maxHeightClass)}>
        {filtered.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-muted-foreground">{emptyMessage}</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {filtered.map((o) => {
              const checked = selected.has(o.value);
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    onClick={() => onToggle(o.value)}
                    className={cn(
                      "flex w-full items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors",
                      checked
                        ? "border-[#2563eb] bg-[#eff6ff]"
                        : "border-transparent hover:border-border hover:bg-muted/50"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-[18px] shrink-0 items-center justify-center border-[1.5px] text-white",
                        single ? "rounded-full" : "rounded-[5px]",
                        checked ? "border-[#2563eb] bg-[#2563eb]" : "border-slate-300 bg-white"
                      )}
                    >
                      {checked ? (
                        <svg viewBox="0 0 24 24" className="size-3" fill="none">
                          <path d="M5 12l5 5L20 6" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      ) : null}
                    </span>
                    {showAvatar ? (
                      <span
                        className="flex size-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold text-white"
                        style={{ background: o.color ?? "#64748b" }}
                      >
                        {avatarText(o)}
                      </span>
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-semibold text-slate-800">{o.label}</span>
                      {o.subtitle ? (
                        <span className="block truncate text-[11px] text-muted-foreground">{o.subtitle}</span>
                      ) : null}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/**
 * Filtr uchun ixcham ko'p tanlovli dropdown (tizimdagi filterga o'xshash):
 * tugma bosilganda qidiruvli, scrollli ro'yxat portal orqali ochiladi.
 */
export function FilterMultiSelect({
  options,
  selected,
  onChange,
  placeholder,
  searchPlaceholder = "Qidirish…",
  minPopoverWidth = 260,
  className,
  single = false
}: {
  options: PickOption[];
  selected: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  searchPlaceholder?: string;
  minPopoverWidth?: number;
  className?: string;
  /** Bir vaqtda faqat bitta qiymat (filial kabi). */
  single?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [coords, setCoords] = useState({ top: 0, left: 0, width: minPopoverWidth });
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  useEffect(() => setMounted(true), []);

  const triggerLabel = useMemo(() => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) {
      return options.find((o) => o.value === selected[0])?.label ?? placeholder;
    }
    return `${placeholder}: ${selected.length}`;
  }, [selected, options, placeholder]);

  const updatePosition = useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
    const w = Math.min(Math.max(r.width, minPopoverWidth), vw - 16);
    let left = r.left;
    if (left + w > vw - 8) left = Math.max(8, vw - w - 8);
    setCoords({ top: r.bottom + 6, left, width: w });
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
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (value: string) => {
    if (single) {
      const next = selectedSet.has(value) ? [] : [value];
      onChange(next);
      if (next.length > 0) setOpen(false);
      return;
    }
    onChange(selectedSet.has(value) ? selected.filter((v) => v !== value) : [...selected, value]);
  };

  const popover = (
    <div
      ref={popRef}
      id={listId}
      className="fixed z-[2000] flex max-h-[min(55vh,440px)] flex-col overflow-hidden rounded-xl border border-border bg-card p-2 text-card-foreground shadow-xl ring-1 ring-black/5"
      style={{ top: coords.top, left: coords.left, width: coords.width }}
    >
      <SearchablePickList
        options={options}
        selected={selectedSet}
        onToggle={toggle}
        searchPlaceholder={searchPlaceholder}
        maxHeightClass="max-h-[min(42vh,320px)]"
        showAvatar
        single={single}
      />
      {selected.length > 0 ? (
        <button
          type="button"
          onClick={() => onChange([])}
          className="mt-1 shrink-0 rounded-md px-2 py-1.5 text-left text-xs font-semibold text-rose-600 hover:bg-rose-50"
        >
          Tozalash ({selected.length})
        </button>
      ) : null}
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={listId}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-xl border border-[#e2e8f0] bg-white px-3 text-left text-[13px] font-semibold text-slate-700 transition-colors hover:border-[#2563eb]",
          selected.length > 0 && "border-[#2563eb] text-[#1d4ed8]",
          className
        )}
      >
        <span className="min-w-0 flex-1 truncate">{triggerLabel}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-slate-400 transition-transform", open && "rotate-180")} aria-hidden />
      </button>
      {mounted && open ? createPortal(popover, document.body) : null}
    </>
  );
}
