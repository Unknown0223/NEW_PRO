"use client";

import { cn } from "@/lib/utils";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type RefObject
} from "react";
import { createPortal } from "react-dom";

const POPOVER_GAP = 4;
const POPOVER_Z = 10050;

function splitTerritoryValues(raw: string | null | undefined): string[] {
  const t = raw?.trim();
  if (!t) return [];
  return t
    .split(/\s*,\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function OverflowListPortal({
  open,
  anchorRef,
  panelId,
  items,
  onClose,
  onKeepOpen
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  panelId: string;
  items: string[];
  onClose: () => void;
  onKeepOpen: () => void;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties | null>(null);

  const relayout = useCallback(() => {
    const anchor = anchorRef.current;
    if (!anchor || typeof window === "undefined") {
      setStyle(null);
      return;
    }
    const rect = anchor.getBoundingClientRect();
    const minWidth = Math.max(160, Math.min(288, rect.width + 48));
    const spaceBelow = window.innerHeight - rect.bottom - POPOVER_GAP;
    const spaceAbove = rect.top - POPOVER_GAP;
    const placeAbove = spaceBelow < 140 && spaceAbove > spaceBelow;
    const maxHeight = Math.min(224, Math.max(96, placeAbove ? spaceAbove : spaceBelow));
    const left = Math.min(
      Math.max(8, rect.left),
      window.innerWidth - minWidth - 8
    );

    setStyle(
      placeAbove
        ? {
            position: "fixed",
            left,
            bottom: window.innerHeight - rect.top + POPOVER_GAP,
            minWidth,
            maxWidth: 288,
            maxHeight,
            zIndex: POPOVER_Z
          }
        : {
            position: "fixed",
            left,
            top: rect.bottom + POPOVER_GAP,
            minWidth,
            maxWidth: 288,
            maxHeight,
            zIndex: POPOVER_Z
          }
    );
  }, [anchorRef]);

  useLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }
    relayout();
  }, [open, relayout, items.length]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", relayout);
    window.addEventListener("scroll", relayout, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", relayout);
      window.removeEventListener("scroll", relayout, true);
    };
  }, [open, onClose, relayout, anchorRef]);

  if (!open || !style || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={menuRef}
      id={panelId}
      role="list"
      style={style}
      className="overflow-y-auto rounded-md border border-border bg-white p-2 shadow-lg"
      onMouseEnter={onKeepOpen}
      onMouseLeave={onClose}
    >
      <ul className="space-y-1">
        {items.map((item, i) => (
          <li
            key={`${item}-${i}`}
            role="listitem"
            className="rounded px-1.5 py-1 text-xs leading-snug text-foreground"
          >
            {item}
          </li>
        ))}
      </ul>
    </div>,
    document.body
  );
}

/**
 * Birinchi qiymat + «ещё N»; hover/click — portal modal (jadval overflow ichida qirqilmaydi).
 */
export function WorkSlotsTerritoryOverflowCell({
  raw,
  items: itemsProp,
  resolve,
  className
}: {
  raw?: string | null | undefined;
  /** Tayyor ro‘yxat (vergul bilan split qilinmaydi). */
  items?: string[] | null;
  resolve?: (s: string) => string;
  className?: string;
}) {
  const items = (itemsProp?.length ? itemsProp : splitTerritoryValues(raw)).map((v) =>
    resolve ? resolve(v) : v
  );
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  if (items.length === 0) {
    return <span className="text-muted-foreground">—</span>;
  }

  const first = items[0]!;
  const rest = items.length - 1;

  if (rest <= 0) {
    return (
      <span className={cn("block max-w-[12rem] truncate", className)} title={first}>
        {first}
      </span>
    );
  }

  const clearClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = () => {
    clearClose();
    closeTimer.current = setTimeout(() => setOpen(false), 120);
  };

  return (
    <div
      ref={rootRef}
      className={cn("relative inline-flex max-w-[14rem] items-baseline gap-1", className)}
      onMouseEnter={() => {
        clearClose();
        setOpen(true);
      }}
      onMouseLeave={scheduleClose}
    >
      <span className="min-w-0 truncate" title={first}>
        {first}
      </span>
      <button
        type="button"
        className="shrink-0 text-[11px] font-medium text-teal-700 underline-offset-2 hover:underline"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={(e) => {
          e.stopPropagation();
          clearClose();
          setOpen((v) => !v);
        }}
        onFocus={() => {
          clearClose();
          setOpen(true);
        }}
        onBlur={scheduleClose}
      >
        ещё {rest}
      </button>
      <OverflowListPortal
        open={open}
        anchorRef={rootRef}
        panelId={panelId}
        items={items}
        onClose={scheduleClose}
        onKeepOpen={clearClose}
      />
    </div>
  );
}
