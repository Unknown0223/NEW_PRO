"use client";

import Link from "next/link";
import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type PayrollMenuItem = {
  id: string;
  label: string;
  icon?: ReactNode;
  href?: string;
  onClick?: () => void;
  disabled?: boolean;
  destructive?: boolean;
};

const ITEM = "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-50";

export function PayrollMoreMenu({ items, label = "Ещё" }: { items: PayrollMenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!items.length) return null;
  return (
    <div className="relative" ref={ref}>
      <Button type="button" variant="outline" size="icon" className="h-9 w-9" title={label} aria-label={label} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <MoreHorizontal className="size-4" />
      </Button>
      {open ? (
        <div role="menu" className="absolute right-0 top-[calc(100%+6px)] z-40 min-w-[200px] rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg">
          {items.map((it) =>
            it.href ? (
              <Link key={it.id} role="menuitem" href={it.href} className={ITEM} onClick={() => setOpen(false)}>
                {it.icon}
                {it.label}
              </Link>
            ) : (
              <button
                key={it.id}
                role="menuitem"
                type="button"
                disabled={it.disabled}
                className={cn(ITEM, it.destructive && "text-red-700 dark:text-red-400")}
                onClick={() => {
                  setOpen(false);
                  it.onClick?.();
                }}
              >
                {it.icon}
                {it.label}
              </button>
            )
          )}
        </div>
      ) : null}
    </div>
  );
}
