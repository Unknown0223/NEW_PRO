"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  formatOutletClassBandsSummary,
  formatThresholdShort,
  parseOutletClassBandsString,
  serializeOutletClassBands,
  type OutletClassBandDraft
} from "@/lib/outlet-class-bands";

type Props = {
  label?: string;
  value: string;
  onChange: (next: string) => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  compact?: boolean;
};

const DEFAULT_RAW = "A:1000000,B:500000,C:100000,D:0";

/**
 * Klass chegaralari: bosilsa ochiladi, yana bosilsa yopiladi.
 * Portal — filtr qatori `overflow-x-auto` ichida kesilmasin.
 */
export function BandsFilter({
  label = "Пороги",
  value,
  onChange,
  open: openProp,
  onOpenChange,
  compact
}: Props) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = openProp ?? uncontrolledOpen;
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [coords, setCoords] = useState({ top: 0, left: 0, width: 300 });
  const [draft, setDraft] = useState<OutletClassBandDraft[]>(() => parseOutletClassBandsString(value));
  const [editTexts, setEditTexts] = useState<string[]>(() =>
    parseOutletClassBandsString(value).map((b) => String(Math.round(b.minSum)))
  );

  useEffect(() => setMounted(true), []);

  const setOpen = useCallback(
    (next: boolean) => {
      if (openProp === undefined) setUncontrolledOpen(next);
      if (next !== open) onOpenChange?.(next);
    },
    [onOpenChange, open, openProp]
  );

  useEffect(() => {
    if (!open) return;
    const bands = parseOutletClassBandsString(value);
    setDraft(bands);
    setEditTexts(bands.map((b) => String(Math.round(b.minSum))));
  }, [open, value]);

  const updatePosition = useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(Math.max(r.width, 300), Math.min(360, vw - 16));
    let left = r.left;
    if (left + w > vw - 8) left = Math.max(8, vw - w - 8);
    const gap = 6;
    const popH = popRef.current?.offsetHeight ?? 280;
    let top = r.bottom + gap;
    if (top + popH > vh - 8) {
      const above = r.top - gap - popH;
      top = above >= 8 ? above : Math.max(8, vh - popH - 8);
    }
    setCoords((prev) =>
      prev.top === top && prev.left === left && prev.width === w ? prev : { top, left, width: w }
    );
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePosition();
    const raf = requestAnimationFrame(updatePosition);
    window.addEventListener("scroll", updatePosition);
    window.addEventListener("resize", updatePosition);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", updatePosition);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, updatePosition]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    let onDoc: ((e: MouseEvent) => void) | null = null;
    const timer = window.setTimeout(() => {
      onDoc = (e: MouseEvent) => {
        const node = e.target as Node;
        if (triggerRef.current?.contains(node)) return;
        if (popRef.current?.contains(node)) return;
        setOpen(false);
      };
      document.addEventListener("mousedown", onDoc);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      if (onDoc) document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen]);

  const commitBands = (next: OutletClassBandDraft[]) => {
    const sorted = next.slice().sort((a, b) => b.minSum - a.minSum);
    setDraft(sorted);
    setEditTexts(sorted.map((b) => String(Math.round(b.minSum))));
    onChange(serializeOutletClassBands(sorted));
  };

  const applyEditAt = (idx: number, text: string) => {
    setEditTexts((prev) => prev.map((t, i) => (i === idx ? text : t)));
    const cleaned = text.trim().replace(/\s/g, "").replace(",", ".");
    if (cleaned === "") return;
    const n = Number.parseFloat(cleaned);
    if (!Number.isFinite(n) || n < 0) return;
    const next = draft.map((b, i) => (i === idx ? { ...b, minSum: n } : b));
    setDraft(next);
    onChange(serializeOutletClassBands(next));
  };

  const summary = formatOutletClassBandsSummary(value);

  const panel = (
    <div
      ref={popRef}
      id={listId}
      role="dialog"
      aria-label={label}
      className="fixed z-[600] flex flex-col overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-lg ring-1 ring-black/5"
      style={{ top: coords.top, left: coords.left, width: coords.width }}
    >
      <div className="border-b border-border/80 bg-muted/40 px-3 py-2">
        <p className="text-xs font-semibold tracking-tight">{label} классов</p>
        <p className="mt-0.5 text-[10px] text-muted-foreground">Мин. сумма продаж за период</p>
      </div>
      <ul className="divide-y divide-border/60 px-2 py-1">
        {draft.map((band, idx) => (
          <li key={`${band.name}-${idx}`} className="flex items-center gap-2 py-1.5">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
              {band.name}
            </span>
            <span className="shrink-0 text-[11px] text-muted-foreground">≥</span>
            <Input
              className="h-8 flex-1 font-mono text-xs tabular-nums"
              inputMode="decimal"
              value={editTexts[idx] ?? String(Math.round(band.minSum))}
              aria-label={`Порог ${band.name}`}
              onChange={(e) => applyEditAt(idx, e.target.value)}
              onBlur={() => {
                const n = Number.parseFloat(
                  String(editTexts[idx] ?? "")
                    .trim()
                    .replace(/\s/g, "")
                    .replace(",", ".")
                );
                if (!Number.isFinite(n) || n < 0) {
                  setEditTexts((prev) =>
                    prev.map((t, i) => (i === idx ? String(Math.round(band.minSum)) : t))
                  );
                  return;
                }
                commitBands(draft.map((b, i) => (i === idx ? { ...b, minSum: n } : b)));
              }}
            />
            <span className="w-14 shrink-0 text-right text-[10px] text-muted-foreground">
              {formatThresholdShort(band.minSum)}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between gap-2 border-t border-border/60 bg-muted/15 px-2 py-1.5">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-[11px] text-muted-foreground"
          onClick={() => commitBands(parseOutletClassBandsString(DEFAULT_RAW))}
        >
          Сбросить
        </Button>
        <Button type="button" size="sm" className="h-7 px-3 text-[11px]" onClick={() => setOpen(false)}>
          Готово
        </Button>
      </div>
    </div>
  );

  return (
    <div className="w-full min-w-0">
      <button
        ref={triggerRef}
        type="button"
        className={cn(
          "relative flex min-h-8 w-full min-w-0 items-center justify-between gap-2 rounded-lg border border-input bg-background px-2 py-1.5 text-left text-xs shadow-sm outline-none transition-colors",
          "hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring",
          open && "ring-2 ring-ring",
          compact && "h-8 min-h-8 px-2 text-xs"
        )}
        aria-expanded={open}
        aria-controls={listId}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
      >
        <span className="pointer-events-none absolute left-2 top-0 z-[1] -translate-y-1/2 bg-card px-1 text-[11px] font-medium leading-none text-muted-foreground">
          {label}
        </span>
        <span className="min-w-0 flex-1 truncate pt-1" title={summary}>
          {summary}
        </span>
        <ChevronDown
          className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")}
          aria-hidden
        />
      </button>
      {mounted && open ? createPortal(panel, document.body) : null}
    </div>
  );
}
