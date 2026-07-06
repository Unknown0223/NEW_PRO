"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject
} from "react";
import { createPortal } from "react-dom";

const POPOVER_GAP = 4;
const POPOVER_Z = 10050;

type Props = {
  items: string[];
  title: string;
  anchorRef: RefObject<HTMLElement | null>;
  trigger: ReactNode;
};

function ClientsListPopover({
  open,
  anchorRef,
  onClose,
  items,
  title
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  items: string[];
  title: string;
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
  const minWidth = Math.max(220, rect.width);
  const spaceBelow = window.innerHeight - rect.bottom - POPOVER_GAP;
  const spaceAbove = rect.top - POPOVER_GAP;
  const placeAbove = spaceBelow < 120 && spaceAbove > spaceBelow;
  const maxHeight = Math.min(240, Math.max(80, placeAbove ? spaceAbove : spaceBelow));

  const style: React.CSSProperties = placeAbove
    ? {
        position: "fixed",
        left: rect.left + rect.width / 2,
        bottom: window.innerHeight - rect.top + POPOVER_GAP,
        transform: "translateX(-50%)",
        minWidth,
        maxWidth: 320,
        maxHeight,
        zIndex: POPOVER_Z
      }
    : {
        position: "fixed",
        left: rect.left + rect.width / 2,
        top: rect.bottom + POPOVER_GAP,
        transform: "translateX(-50%)",
        minWidth,
        maxWidth: 320,
        maxHeight,
        zIndex: POPOVER_Z
      };

  return createPortal(
    <div
      ref={menuRef}
      style={style}
      className="overflow-hidden rounded-lg border border-border bg-card shadow-2xl"
      role="listbox"
      aria-label={title}
    >
      <div className="flex items-center justify-between border-b border-border bg-muted px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-gray-500">{title}</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded p-0.5 text-gray-400 transition-colors hover:bg-muted hover:text-gray-600"
          aria-label="Закрыть"
        >
          <X className="size-3.5" />
        </button>
      </div>
      <div className="scrollbar-none max-h-60 overflow-y-auto py-1">
        {items.map((item, i) => (
          <div
            key={`${item}-${i}`}
            role="option"
            aria-selected={false}
            className={cn(
              "cursor-default px-3 py-2 text-xs text-gray-700 transition-colors hover:bg-emerald-50 hover:text-emerald-700",
              i < items.length - 1 && "border-b border-gray-50"
            )}
          >
            {item}
          </div>
        ))}
      </div>
    </div>,
    document.body
  );
}

/** «ещё N» — ro‘yxat portal orqali (jadval scroll ichida qolmaydi). */
export function ClientsListPopup({ items, title, anchorRef, trigger }: Props) {
  const [open, setOpen] = useState(false);

  const toggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setOpen((v) => !v);
  }, []);

  return (
    <>
      <span
        role="button"
        tabIndex={0}
        className="inline-flex shrink-0 items-center"
        onClick={toggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen((v) => !v);
          }
        }}
      >
        {trigger}
      </span>
      <ClientsListPopover
        open={open}
        anchorRef={anchorRef}
        onClose={() => setOpen(false)}
        items={items}
        title={title}
      />
    </>
  );
}
