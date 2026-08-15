"use client";

import { useDraggable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { AggregationType } from "@salec/pivot-engine";
import { getPivotStrings, summarizePivotFilter } from "@salec/pivot-engine";
import { GripVertical, Filter, X } from "lucide-react";
import { cn } from "@/lib/utils";

function aggregationOptions() {
  const aggs = getPivotStrings().aggregations;
  return (Object.keys(aggs) as AggregationType[]).map((value) => ({
    value,
    label: aggs[value]
  }));
}

type Props = {
  id: string;
  label: string;
  disabled?: boolean;
};

export function FieldChip({ id, label, disabled }: Props) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `palette:${id}`,
    data: { fieldId: id },
    disabled
  });

  return (
    <button
      ref={setNodeRef}
      type="button"
      className={cn(
        "inline-flex max-w-full items-center gap-1 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs",
        disabled && "cursor-not-allowed opacity-40",
        isDragging && "opacity-60"
      )}
      {...listeners}
      {...attributes}
      disabled={disabled}
    >
      <GripVertical className="h-3 w-3 shrink-0 text-muted-foreground" />
      <span className="truncate">{label}</span>
    </button>
  );
}

export function ZoneChip({
  id,
  label,
  filter,
  onConfigure,
  onRemove,
  sortableId
}: {
  id: string;
  label: string;
  filter?: import("@salec/pivot-engine").PivotFilter;
  onConfigure?: () => void;
  onRemove: () => void;
  sortableId?: string;
}) {
  const f = getPivotStrings().filters;
  const summary = summarizePivotFilter(filter);
  const sortable = useSortable({ id: sortableId ?? id, disabled: !sortableId });
  const style = sortableId
    ? {
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition
      }
    : undefined;

  return (
    <div
      ref={sortableId ? sortable.setNodeRef : undefined}
      style={style}
      className="mb-1 flex items-center gap-1 rounded border border-border bg-background px-1 py-0.5 text-xs"
    >
      {sortableId && (
        <button
          type="button"
          className="shrink-0 cursor-grab rounded p-0.5 text-muted-foreground hover:bg-muted active:cursor-grabbing"
          aria-label={f.reorder}
          {...sortable.attributes}
          {...sortable.listeners}
        >
          <GripVertical className="h-3 w-3" />
        </button>
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {onConfigure && (
        <button
          type="button"
          onClick={onConfigure}
          className={cn(
            "inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 hover:bg-muted",
            summary ? "bg-primary/10 text-primary" : "text-muted-foreground"
          )}
          aria-label={f.configureFilter}
        >
          <Filter className="h-3 w-3" />
          {summary && <span className="text-[9px]">{summary}</span>}
        </button>
      )}
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted"
        aria-label={f.remove}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

export function ValueZoneChip({
  id,
  label,
  aggregation,
  onAggregationChange,
  onRemove
}: {
  id: string;
  label: string;
  aggregation: AggregationType;
  onAggregationChange?: (aggregation: AggregationType) => void;
  onRemove: () => void;
}) {
  const f = getPivotStrings().filters;
  return (
    <div className="mb-1 flex items-center gap-1 rounded border border-border bg-background px-1 py-0.5 text-xs">
      <span className="min-w-0 max-w-[5rem] truncate">{label}</span>
      <select
        value={aggregation}
        onChange={(e) => onAggregationChange?.(e.target.value as AggregationType)}
        disabled={!onAggregationChange}
        className="h-5 max-w-[6.5rem] shrink-0 rounded border border-border bg-muted/30 px-0.5 text-[10px]"
        aria-label={`${label} — ${f.metricOptional}`}
      >
        {aggregationOptions().map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted"
        aria-label={f.remove}
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}
