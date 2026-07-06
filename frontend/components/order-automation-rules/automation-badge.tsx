"use client";

import { AUTOMATION_BADGE_COLORS } from "@/components/order-automation-rules/automation-display";
import { cn } from "@/lib/utils";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

export function AutomationBadge({ value }: { value: string }) {
  const colorClass = AUTOMATION_BADGE_COLORS[value] ?? "bg-muted text-gray-700 border-border";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium",
        colorClass
      )}
    >
      {value}
    </span>
  );
}

export function AutomationBadgeList({ values, mapLabel }: { values: string[]; mapLabel?: (v: string) => string }) {
  if (!values.length) return <span className="text-sm text-gray-300">—</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {values.map((v) => (
        <AutomationBadge key={v} value={mapLabel ? mapLabel(v) : v} />
      ))}
    </div>
  );
}

const POPOVER_GAP = 6;
const POPOVER_Z = 10050;

function AutomationMorePopover({
  open,
  anchorRef,
  onClose,
  items
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  items: { key: string; label: string }[];
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [, setLayoutTick] = useState(0);
  const relayout = useCallback(() => setLayoutTick((n) => n + 1), []);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (anchorRef.current?.contains(t) || menuRef.current?.contains(t)) return;
      onClose();
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open, onClose, anchorRef]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("resize", relayout);
    window.addEventListener("scroll", relayout, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", relayout);
      window.removeEventListener("scroll", relayout, true);
    };
  }, [open, onClose, relayout]);

  if (!open || typeof document === "undefined") return null;

  const anchor = anchorRef.current;
  if (!anchor) return null;

  const rect = anchor.getBoundingClientRect();
  const minWidth = Math.max(160, rect.width);
  const spaceBelow = window.innerHeight - rect.bottom - POPOVER_GAP;
  const spaceAbove = rect.top - POPOVER_GAP;
  const placeAbove = spaceBelow < 100 && spaceAbove > spaceBelow;
  const maxHeight = Math.min(280, Math.max(80, placeAbove ? spaceAbove : spaceBelow));

  const style: React.CSSProperties = placeAbove
    ? {
        position: "fixed",
        left: rect.left,
        bottom: window.innerHeight - rect.top + POPOVER_GAP,
        minWidth,
        maxWidth: 280,
        maxHeight,
        overflowY: "auto",
        zIndex: POPOVER_Z
      }
    : {
        position: "fixed",
        left: rect.left,
        top: rect.bottom + POPOVER_GAP,
        minWidth,
        maxWidth: 280,
        maxHeight,
        overflowY: "auto",
        zIndex: POPOVER_Z
      };

  return createPortal(
    <div
      ref={menuRef}
      style={style}
      className="rounded-lg border border-border bg-card py-1 shadow-lg"
      role="listbox"
    >
      {items.map((item, i) => (
        <div
          key={item.key}
          role="option"
          aria-selected={false}
          className={cn(
            "px-3 py-1.5 text-xs text-gray-700",
            i < items.length - 1 && "border-b border-border"
          )}
        >
          {item.label}
        </div>
      ))}
    </div>,
    document.body
  );
}

/** Jadval qatorini cho‘zmaslik: birinchi badge + «ещё N» (portal — scroll ichida qolmaydi). */
export function AutomationBadgeListCompact({
  values,
  mapLabel,
  maxVisible = 1
}: {
  values: string[];
  mapLabel?: (v: string) => string;
  maxVisible?: number;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  if (!values.length) return <span className="text-sm text-gray-300">—</span>;

  const items = values.map((raw) => ({
    key: raw,
    label: mapLabel ? mapLabel(raw) : raw
  }));
  const visible = items.slice(0, maxVisible);
  const hiddenCount = items.length - visible.length;

  return (
    <div className="flex max-w-full flex-nowrap items-center gap-1.5">
      {visible.map((item) => (
        <AutomationBadge key={item.key} value={item.label} />
      ))}
      {hiddenCount > 0 ? (
        <>
          <button
            ref={triggerRef}
            type="button"
            className="shrink-0 whitespace-nowrap text-xs font-medium text-teal-600 hover:text-teal-800 hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
          >
            ещё {hiddenCount}
          </button>
          <AutomationMorePopover
            open={open}
            anchorRef={triggerRef}
            onClose={() => setOpen(false)}
            items={items}
          />
        </>
      ) : null}
    </div>
  );
}

export function ReadOnlyText({
  children,
  link
}: {
  children: React.ReactNode;
  link?: boolean;
}) {
  if (children == null || children === "" || children === "—") {
    return <span className="text-sm text-gray-300">—</span>;
  }
  if (link) {
    return (
      <span className="text-sm text-teal-600 hover:text-teal-800 hover:underline cursor-default">
        {children}
      </span>
    );
  }
  return <span className="text-sm text-gray-700">{children}</span>;
}
