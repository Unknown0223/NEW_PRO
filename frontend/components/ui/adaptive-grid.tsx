"use client";

import * as React from "react";
import { LayoutGrid, List } from "lucide-react";
import { cn } from "@/lib/utils";

export type DataViewMode = "table" | "grid";

export type AdaptiveFieldSize = "sm" | "md" | "lg" | "full";

/** Maydon kaliti/sarlavhasiga qarab yonma-yon joylashuv o‘lchami */
export function inferFieldSize(key: string, header?: string): AdaptiveFieldSize {
  const t = `${key} ${header ?? ""}`.toLowerCase();
  if (
    /address|адрес|comment|коммент|описан|description|orientir|ориентир|legal|юридич/.test(t)
  ) {
    return "full";
  }
  if (
    /name|назван|наименован|продукт|product|parent|родител|категор|category|организац/.test(t)
  ) {
    return "lg";
  }
  if (
    /code|код|sku|sort|сортир|level|уровень|phone|телефон|price|цена|qty|количеств|miqdor|default|умолчан|unit|единиц/.test(
      t
    )
  ) {
    return "sm";
  }
  return "md";
}

const SIZE_CLASS: Record<AdaptiveFieldSize, string> = {
  sm: "col-span-1 min-w-0",
  md: "col-span-1 min-w-0 sm:col-span-1 md:col-span-1",
  lg: "col-span-1 min-w-0 sm:col-span-2",
  full: "col-span-1 min-w-0 sm:col-span-2 lg:col-span-3"
};

type ViewModeToggleProps = {
  value: DataViewMode;
  onChange: (mode: DataViewMode) => void;
  className?: string;
  labels?: { table?: string; grid?: string };
};

/** Jadval / Grid — tizim bo‘ylab bitta toggle */
export function ViewModeToggle({ value, onChange, className, labels }: ViewModeToggleProps) {
  return (
    <div
      className={cn("inline-flex rounded-lg border border-slate-200 bg-white p-0.5", className)}
      role="group"
      aria-label="Ko‘rinish"
    >
      <button
        type="button"
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
          value === "table" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
        )}
        onClick={() => onChange("table")}
        aria-pressed={value === "table"}
      >
        <List className="size-3.5" />
        {labels?.table ?? "Jadval"}
      </button>
      <button
        type="button"
        className={cn(
          "inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors",
          value === "grid" ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-50"
        )}
        onClick={() => onChange("grid")}
        aria-pressed={value === "grid"}
      >
        <LayoutGrid className="size-3.5" />
        {labels?.grid ?? "Grid"}
      </button>
    </div>
  );
}

type AdaptiveCardGridProps = {
  children: React.ReactNode;
  className?: string;
  /** Kartochka minimal kengligi (px) — shunga qarab yonma-yon joylashadi */
  minCardWidth?: number;
  /** `none` — scroll cheklovisiz (sahifa bo‘ylab) */
  maxHeight?: string;
};

/**
 * Kartochkalar ekran/kontent o‘lchamiga qarab avtomatik yonma-yon.
 * `auto-fill` + `minmax` — kichiklar yonma-yon, katta bo‘shliqda ko‘proq ustun.
 */
export function AdaptiveCardGrid({
  children,
  className,
  minCardWidth = 280,
  maxHeight = "32rem"
}: AdaptiveCardGridProps) {
  return (
    <div
      className={cn(maxHeight === "none" ? null : "overflow-auto pr-0.5", className)}
      style={maxHeight === "none" ? undefined : { maxHeight }}
    >
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(min(100%, ${minCardWidth}px), 1fr))`
        }}
      >
        {children}
      </div>
    </div>
  );
}

type AdaptiveFieldGridProps = {
  children: React.ReactNode;
  className?: string;
};

/** Ichki maydonlar: 1→2→3 ustun, size bo‘yicha span */
export function AdaptiveFieldGrid({ children, className }: AdaptiveFieldGridProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3",
        className
      )}
    >
      {children}
    </div>
  );
}

type AdaptiveFieldCellProps = {
  size?: AdaptiveFieldSize;
  className?: string;
  children: React.ReactNode;
};

export function AdaptiveFieldCell({ size = "md", className, children }: AdaptiveFieldCellProps) {
  return <div className={cn(SIZE_CLASS[size], className)}>{children}</div>;
}

type AdaptiveGridCardProps = {
  children: React.ReactNode;
  className?: string;
  tone?: "default" | "error" | "warning";
  header?: React.ReactNode;
  footer?: React.ReactNode;
};

export function AdaptiveGridCard({
  children,
  className,
  tone = "default",
  header,
  footer
}: AdaptiveGridCardProps) {
  return (
    <article
      className={cn(
        "flex min-w-0 flex-col rounded-xl border bg-white p-3 shadow-sm",
        tone === "error" && "border-destructive/30 bg-destructive/[0.02]",
        tone === "warning" && "border-amber-200 bg-amber-50/40",
        tone === "default" && "border-slate-200",
        className
      )}
    >
      {header ? <div className="mb-2.5 flex items-center justify-between gap-2">{header}</div> : null}
      <div className="min-w-0 flex-1">{children}</div>
      {footer ? <div className="mt-2">{footer}</div> : null}
    </article>
  );
}

const VIEW_MODE_KEY = "salec.dataViewMode";

export function loadDataViewMode(fallback: DataViewMode = "grid"): DataViewMode {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(VIEW_MODE_KEY);
    return v === "table" || v === "grid" ? v : fallback;
  } catch {
    return fallback;
  }
}

export function saveDataViewMode(mode: DataViewMode) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(VIEW_MODE_KEY, mode);
  } catch {
    /* ignore */
  }
}

/** LocalStorage bilan bog‘langan umumiy view mode hook */
export function useDataViewMode(fallback: DataViewMode = "grid") {
  const [mode, setMode] = React.useState<DataViewMode>(fallback);
  React.useEffect(() => {
    setMode(loadDataViewMode(fallback));
  }, [fallback]);

  const setViewMode = React.useCallback((next: DataViewMode) => {
    setMode(next);
    saveDataViewMode(next);
  }, []);

  return [mode, setViewMode] as const;
}
