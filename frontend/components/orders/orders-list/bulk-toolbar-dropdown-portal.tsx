"use client";

import { cn } from "@/lib/utils";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject
} from "react";
import { createPortal } from "react-dom";

const GAP_PX = 8;

/**
 * Pastki bulk-panel: menyu doim tugma ustida (`bottom`, transform yo‘q).
 */
export function BulkToolbarDropdownPortal({
  open,
  anchorRef,
  onClose,
  className,
  children,
  minWidth = 200
}: {
  open: boolean;
  anchorRef: RefObject<HTMLElement | null>;
  onClose: () => void;
  className?: string;
  children: ReactNode;
  minWidth?: number;
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
    window.addEventListener("resize", relayout);
    window.addEventListener("scroll", relayout, true);
    return () => {
      window.removeEventListener("resize", relayout);
      window.removeEventListener("scroll", relayout, true);
    };
  }, [open, relayout]);

  if (!open || typeof document === "undefined") return null;

  const anchor = anchorRef.current;
  if (!anchor) return null;

  const rect = anchor.getBoundingClientRect();
  const menuWidth = Math.max(minWidth, rect.width);
  const spaceAbove = rect.top - GAP_PX;

  const style = {
    position: "fixed" as const,
    left: rect.left,
    bottom: window.innerHeight - rect.top + GAP_PX,
    minWidth: menuWidth,
    maxHeight: Math.max(120, spaceAbove),
    overflowY: "auto" as const,
    zIndex: 10050
  };

  return createPortal(
    <div
      ref={menuRef}
      style={style}
      className={cn(
        "bulk-toolbar-dropdown-menu rounded-lg border border-border bg-card py-1 shadow-xl",
        className
      )}
      role="menu"
    >
      {children}
    </div>,
    document.body
  );
}
