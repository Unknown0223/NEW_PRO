"use client";

import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Filter, GripVertical } from "lucide-react";
import { useMemo, useState } from "react";
import type { AggregationType, PivotConfig, PivotField, PivotFilter } from "@salec/pivot-engine";
import { getCalculatedMeasurePresets, getFieldMembers, getPivotStrings, summarizePivotFilter } from "@salec/pivot-engine";
import { FilterEditor } from "@/components/pivot/PivotFilters";
import { cn } from "@/lib/utils";
import { FieldChip, ValueZoneChip, ZoneChip } from "./FieldChip";
import { DropZone, type BuilderZone } from "./DropZone";
import {
  PALETTE_PREFIX,
  parsePaletteId,
  parseSortableZoneId,
  pivotFieldsCollisionDetection,
  resolveDropZone,
  sortableZoneId
} from "@/lib/pivot-fields-dnd";

type Zone = BuilderZone;

type Props = {
  fields: PivotField[];
  config: PivotConfig;
  rawData?: Record<string, unknown>[];
  onAddField: (zone: Zone, fieldId: string) => void;
  onRemoveField: (zone: Zone, fieldId: string) => void;
  onUpdateAggregation?: (fieldId: string, aggregation: AggregationType) => void;
  onSetFilter?: (filter: PivotFilter | null, fieldId?: string) => void;
  onAddCalculatedPreset?: (presetId: string) => void;
  onRemoveCalculatedMeasure?: (id: string) => void;
  onReorderFields?: (zone: "rows" | "columns" | "reportFilters", fieldIds: string[]) => void;
  layout?: "stacked" | "wdr";
};

function usedFieldIds(config: PivotConfig): Set<string> {
  return new Set([
    ...config.rows,
    ...config.columns,
    ...config.reportFilters,
    ...config.values.map((v) => v.fieldId)
  ]);
}

function filterSummary(filter: PivotFilter | undefined): string | null {
  return summarizePivotFilter(filter);
}

function ReportFilterChip({
  id,
  label,
  filter,
  onConfigure,
  onRemove,
  sortableId: sortId
}: {
  id: string;
  label: string;
  filter?: PivotFilter;
  onConfigure: () => void;
  onRemove: () => void;
  sortableId?: string;
}) {
  const summary = filterSummary(filter);
  const f = getPivotStrings().filters;
  const sortable = useSortable({ id: sortId ?? id, disabled: !sortId });
  const style = sortId
    ? {
        transform: CSS.Transform.toString(sortable.transform),
        transition: sortable.transition
      }
    : undefined;

  return (
    <div
      ref={sortId ? sortable.setNodeRef : undefined}
      style={style}
      className="mb-1 flex items-center gap-1 rounded border border-border bg-background px-1 py-0.5 text-xs"
    >
      {sortId && (
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
      <button
        type="button"
        onClick={onRemove}
        className="shrink-0 rounded p-0.5 text-muted-foreground hover:bg-muted"
        aria-label={f.remove}
      >
        ×
      </button>
    </div>
  );
}

export function PivotBuilder({
  fields,
  config,
  rawData = [],
  onAddField,
  onRemoveField,
  onUpdateAggregation,
  onSetFilter,
  onAddCalculatedPreset,
  onRemoveCalculatedMeasure,
  onReorderFields,
  layout = "stacked"
}: Props) {
  const z = getPivotStrings().zones;
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingFilterFieldId, setEditingFilterFieldId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const used = usedFieldIds(config);
  const fieldMap = new Map(fields.map((f) => [f.id, f]));

  const filterMap = useMemo(
    () => new Map(config.filters.map((f) => [f.fieldId, f])),
    [config.filters]
  );

  function handleDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const activeStr = String(active.id);
    const overStr = String(over.id);
    const targetZone =
      resolveDropZone(overStr) ??
      resolveDropZone(over.data.current?.zone as string | undefined);

    const sorted = parseSortableZoneId(activeStr);
    if (sorted) {
      if (targetZone && targetZone !== sorted.zone) {
        if (config.reportFilters.includes(sorted.fieldId)) onRemoveField("reportFilters", sorted.fieldId);
        if (config.rows.includes(sorted.fieldId)) onRemoveField("rows", sorted.fieldId);
        if (config.columns.includes(sorted.fieldId)) onRemoveField("columns", sorted.fieldId);
        if (config.values.some((v) => v.fieldId === sorted.fieldId)) onRemoveField("values", sorted.fieldId);
        onAddField(targetZone, sorted.fieldId);
        return;
      }
      if (!onReorderFields) return;
      const overSorted = parseSortableZoneId(overStr);
      if (overSorted && overSorted.zone === sorted.zone) {
        const items = [...config[sorted.zone]];
        const oldIndex = items.indexOf(sorted.fieldId);
        const newIndex = items.indexOf(overSorted.fieldId);
        if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
          onReorderFields(sorted.zone, arrayMove(items, oldIndex, newIndex));
        }
      }
      return;
    }

    const fieldId = parsePaletteId(activeStr);
    if (!fieldId || !targetZone) return;
    if (!fieldMap.has(fieldId)) return;
    onAddField(targetZone, fieldId);
  }

  const editingField = editingFilterFieldId ? fieldMap.get(editingFilterFieldId) : undefined;

  const zonesPanel = (
    <div className={cn("grid gap-2", layout === "wdr" ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-4")}>
      <DropZone zone="reportFilters">
        <SortableContext
          items={config.reportFilters.map((id) => sortableZoneId("reportFilters", id))}
          strategy={verticalListSortingStrategy}
        >
          {config.reportFilters.map((id) => (
            <ReportFilterChip
              key={id}
              id={id}
              label={fieldMap.get(id)?.label ?? id}
              filter={filterMap.get(id)}
              sortableId={onReorderFields ? sortableZoneId("reportFilters", id) : undefined}
              onConfigure={() => setEditingFilterFieldId(id)}
              onRemove={() => onRemoveField("reportFilters", id)}
            />
          ))}
        </SortableContext>
        {config.reportFilters.length === 0 && (
          <p className="text-[10px] text-muted-foreground">{z.reportFiltersHint}</p>
        )}
      </DropZone>

      <DropZone zone="columns">
        <SortableContext
          items={config.columns.map((id) => sortableZoneId("columns", id))}
          strategy={verticalListSortingStrategy}
        >
          {config.columns.map((id) => (
            <ZoneChip
              key={id}
              id={id}
              label={fieldMap.get(id)?.label ?? id}
              filter={filterMap.get(id)}
              sortableId={onReorderFields ? sortableZoneId("columns", id) : undefined}
              onConfigure={onSetFilter ? () => setEditingFilterFieldId(id) : undefined}
              onRemove={() => onRemoveField("columns", id)}
            />
          ))}
        </SortableContext>
        {config.columns.length === 0 && (
          <p className="text-[10px] text-muted-foreground">{z.columnsHint}</p>
        )}
      </DropZone>

      <DropZone zone="rows">
        <SortableContext
          items={config.rows.map((id) => sortableZoneId("rows", id))}
          strategy={verticalListSortingStrategy}
        >
          {config.rows.map((id) => (
            <ZoneChip
              key={id}
              id={id}
              label={fieldMap.get(id)?.label ?? id}
              filter={filterMap.get(id)}
              sortableId={onReorderFields ? sortableZoneId("rows", id) : undefined}
              onConfigure={onSetFilter ? () => setEditingFilterFieldId(id) : undefined}
              onRemove={() => onRemoveField("rows", id)}
            />
          ))}
        </SortableContext>
        {config.rows.length === 0 && (
          <p className="text-[10px] text-muted-foreground">{z.rowsHint}</p>
        )}
      </DropZone>

      <DropZone zone="values">
        {config.values.map((v) => {
          const calc = config.calculatedMeasures?.find((m) => m.id === v.fieldId);
          return (
            <ValueZoneChip
              key={v.fieldId}
              id={v.fieldId}
              label={calc?.label ?? fieldMap.get(v.fieldId)?.label ?? v.fieldId}
              aggregation={v.aggregation}
              onAggregationChange={
                onUpdateAggregation ? (agg) => onUpdateAggregation(v.fieldId, agg) : undefined
              }
              onRemove={() => {
                if (calc && onRemoveCalculatedMeasure) onRemoveCalculatedMeasure(v.fieldId);
                onRemoveField("values", v.fieldId);
              }}
            />
          );
        })}
        {onAddCalculatedPreset && (
          <div className="mt-1 flex flex-wrap gap-1 border-t border-dashed border-border pt-1">
            {getCalculatedMeasurePresets().map((preset) => (
              <button
                key={preset.id}
                type="button"
                title={preset.description}
                onClick={() => onAddCalculatedPreset(preset.id)}
                className="rounded border border-border bg-muted/30 px-1.5 py-0.5 text-[10px] hover:bg-muted"
              >
                + {preset.label}
              </button>
            ))}
          </div>
        )}
        {config.values.length === 0 && (
          <p className="text-[10px] text-muted-foreground">{z.valuesHint}</p>
        )}
      </DropZone>
    </div>
  );

  const fieldList = (
    <div>
      <div className="mb-1 text-xs font-medium text-muted-foreground">{z.fields}</div>
      <div className="flex flex-wrap gap-1">
        {fields.map((f) => (
          <FieldChip key={f.id} id={f.id} label={f.label} disabled={used.has(f.id)} />
        ))}
      </div>
    </div>
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pivotFieldsCollisionDetection}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={handleDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className={cn("space-y-3", layout === "wdr" && "flex gap-3")}>
        {layout === "wdr" ? (
          <>
            <aside className="w-52 shrink-0 space-y-2 rounded-md border border-border bg-muted/20 p-2">
              {fieldList}
            </aside>
            <div className="min-w-0 flex-1 space-y-2">{zonesPanel}</div>
          </>
        ) : (
          <>
            {fieldList}
            {zonesPanel}
          </>
        )}
      </div>

      {editingField && onSetFilter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
          <div className="relative">
            <FilterEditor
              field={editingField}
              members={getFieldMembers(rawData, editingField.id)}
              allFields={fields}
              filter={filterMap.get(editingField.id)}
              onApply={(filter) => {
                onSetFilter(filter, editingField.id);
                setEditingFilterFieldId(null);
              }}
              onClose={() => setEditingFilterFieldId(null)}
            />
          </div>
        </div>
      )}

      <DragOverlay>
        {activeId ? (
          <div className="rounded border bg-background px-2 py-1 text-xs shadow-md">
            {fieldMap.get(activeId.slice(PALETTE_PREFIX.length))?.label ?? activeId}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
