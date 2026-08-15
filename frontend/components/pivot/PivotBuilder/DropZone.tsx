"use client";

import { useDroppable } from "@dnd-kit/core";
import { getPivotStrings } from "@salec/pivot-engine";
import { cn } from "@/lib/utils";

export type BuilderZone = "rows" | "columns" | "values" | "reportFilters";

export function getZoneLabels(): Record<BuilderZone, string> {
  const z = getPivotStrings().zones;
  return {
    rows: z.rows,
    columns: z.columns,
    values: z.values,
    reportFilters: z.reportFilters
  };
}

/** @deprecated use getZoneLabels() */
export const ZONE_LABELS: Record<BuilderZone, string> = getZoneLabels();

const ZONE_COLORS: Record<BuilderZone, string> = {
  rows: "border-blue-200/80 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/30",
  columns: "border-green-200/80 bg-green-50/50 dark:border-green-900 dark:bg-green-950/30",
  values: "border-purple-200/80 bg-purple-50/50 dark:border-purple-900 dark:bg-purple-950/30",
  reportFilters: "border-amber-200/80 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/30"
};

type Props = {
  zone: BuilderZone;
  children: React.ReactNode;
  className?: string;
};

export function DropZone({ zone, children, className }: Props) {
  const { setNodeRef, isOver } = useDroppable({
    id: `${zone}-zone`,
    data: { zone, type: "zone" }
  });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex min-h-[72px] max-h-[160px] flex-col overflow-hidden rounded-md border-2 border-dashed p-2 transition-colors",
        ZONE_COLORS[zone],
        isOver && "border-primary/60 ring-1 ring-primary/30",
        className
      )}
    >
      <div className="mb-1 shrink-0 text-xs font-semibold">{getZoneLabels()[zone]}</div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
    </div>
  );
}
