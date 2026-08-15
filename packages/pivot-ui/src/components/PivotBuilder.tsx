import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { AggregationType, PivotConfig, PivotField, PivotFilter } from "@salec/pivot-engine";
import { getCalculatedMeasurePresets, getFieldMembers, getPivotStrings } from "@salec/pivot-engine";
import { Filter, GripVertical, X } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { FilterEditor } from "./filters/FilterEditor.js";
import { useFocusTrap } from "../hooks/useFocusTrap.js";
import { cn } from "../lib/cn.js";
import {
  PALETTE_PREFIX,
  parsePaletteId,
  parseSortableZoneId,
  parseValueSortableId,
  pivotFieldsCollisionDetection,
  resolveDropZone,
  sortableZoneId,
  valueSortableId,
  type PivotBuilderZone
} from "../lib/dnd.js";

type Zone = PivotBuilderZone;

type Props = {
  fields: PivotField[];
  config: PivotConfig;
  rawData: Record<string, unknown>[];
  onAddField: (zone: Zone, fieldId: string) => void;
  onRemoveField: (zone: Zone, fieldId: string) => void;
  onUpdateAggregation?: (fieldId: string, aggregation: AggregationType) => void;
  onSetFilter?: (filter: PivotFilter | null, fieldId?: string) => void;
  onAddCalculatedPreset?: (presetId: string) => void;
  onRemoveCalculatedMeasure?: (id: string) => void;
  onReorderFields?: (zone: "rows" | "columns" | "reportFilters", fieldIds: string[]) => void;
  onReorderValueFields?: (fieldIds: string[]) => void;
};

function zoneLabels(): Record<Zone, string> {
  const z = getPivotStrings().zones;
  return {
    reportFilters: z.reportFilters,
    columns: z.columns,
    rows: z.rows,
    values: z.values
  };
}

const ZONE_COLORS: Record<Zone, string> = {
  reportFilters: "border-amber-300 bg-amber-50",
  columns: "border-green-300 bg-green-50",
  rows: "border-blue-300 bg-blue-50",
  values: "border-purple-300 bg-purple-50"
};

function usedIds(config: PivotConfig) {
  return new Set([
    ...config.rows,
    ...config.columns,
    ...config.reportFilters,
    ...config.values.map((v) => v.fieldId)
  ]);
}

function DropZone({ zone, children }: { zone: Zone; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${zone}-zone`, data: { zone } });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-[72px] rounded-md border-2 border-dashed p-2",
        ZONE_COLORS[zone],
        isOver && "ring-2 ring-zinc-400"
      )}
    >
      <div className="mb-1 text-xs font-semibold">{zoneLabels()[zone]}</div>
      {children}
    </div>
  );
}

function FieldChip({ id, label, disabled }: { id: string; label: string; disabled?: boolean }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${PALETTE_PREFIX}${id}`,
    disabled
  });
  return (
    <button
      ref={setNodeRef}
      type="button"
      disabled={disabled}
      className={cn(
        "inline-flex items-center gap-1 rounded border bg-white px-2 py-1 text-xs",
        disabled && "opacity-40",
        isDragging && "opacity-60"
      )}
      {...listeners}
      {...attributes}
    >
      <GripVertical className="h-3 w-3 text-zinc-400" />
      {label}
    </button>
  );
}

function SortableHierarchyChip({
  sortableId,
  label,
  filter,
  onConfigure,
  onRemove
}: {
  sortableId: string;
  label: string;
  filter?: PivotFilter;
  onConfigure?: () => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId
  });
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1
      }}
      className="mb-1 flex items-center gap-1 rounded border bg-white px-1 py-0.5 text-xs"
    >
      <button
        type="button"
        className="cursor-grab rounded p-0.5 text-zinc-400 hover:bg-zinc-100 active:cursor-grabbing"
        aria-label={getPivotStrings().filters.reorder}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3 w-3" />
      </button>
      <span className="flex-1 truncate">{label}</span>
      {onConfigure && (
        <button
          type="button"
          onClick={onConfigure}
          className={cn("rounded p-0.5 hover:bg-zinc-100", filter && "bg-amber-50 text-amber-700")}
          aria-label={getPivotStrings().filters.filter}
        >
          <Filter className="h-3 w-3" />
        </button>
      )}
      <button type="button" onClick={onRemove}>
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

function SortableValueChip({
  sortableId,
  label,
  aggregation,
  aggregations,
  onUpdateAggregation,
  onRemove
}: {
  sortableId: string;
  label: string;
  aggregation: AggregationType;
  aggregations: AggregationType[];
  onUpdateAggregation?: (aggregation: AggregationType) => void;
  onRemove: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId
  });
  const t = getPivotStrings();
  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.6 : 1
      }}
      className="mb-1 flex items-center gap-1 rounded border bg-white px-1 py-0.5 text-xs"
    >
      <button
        type="button"
        className="cursor-grab rounded p-0.5 text-zinc-400 hover:bg-zinc-100 active:cursor-grabbing"
        aria-label={t.filters.reorder}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3 w-3" />
      </button>
      <span className="truncate">{label}</span>
      <select
        value={aggregation}
        onChange={(e) => onUpdateAggregation?.(e.target.value as AggregationType)}
        className="h-5 rounded border text-[10px]"
      >
        {aggregations.map((a) => (
          <option key={a} value={a}>
            {t.aggregations[a]}
          </option>
        ))}
      </select>
      <button type="button" onClick={onRemove}>
        <X className="h-3 w-3" />
      </button>
    </div>
  );
}

const AGGREGATIONS: AggregationType[] = [
  "SUM",
  "COUNT",
  "AVG",
  "MIN",
  "MAX",
  "COUNT_DISTINCT",
  "PERCENT_OF_ROW",
  "PERCENT_OF_COLUMN",
  "PERCENT_OF_TOTAL",
  "RUNNING_TOTAL"
];

export function PivotBuilder({
  fields,
  config,
  rawData,
  onAddField,
  onRemoveField,
  onUpdateAggregation,
  onSetFilter,
  onAddCalculatedPreset,
  onRemoveCalculatedMeasure,
  onReorderFields,
  onReorderValueFields
}: Props) {
  const t = getPivotStrings();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const filterDialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(Boolean(editingFieldId && onSetFilter), filterDialogRef);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const fieldMap = new Map(fields.map((f) => [f.id, f]));
  const filterMap = useMemo(() => new Map(config.filters.map((f) => [f.fieldId, f])), [config.filters]);
  const used = usedIds(config);

  function removeFromAllZones(fieldId: string) {
    if (config.reportFilters.includes(fieldId)) onRemoveField("reportFilters", fieldId);
    if (config.rows.includes(fieldId)) onRemoveField("rows", fieldId);
    if (config.columns.includes(fieldId)) onRemoveField("columns", fieldId);
    if (config.values.some((v) => v.fieldId === fieldId)) {
      onRemoveCalculatedMeasure?.(fieldId);
      onRemoveField("values", fieldId);
    }
  }

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;

    const activeStr = String(active.id);
    const overStr = String(over.id);
    const targetZone =
      resolveDropZone(overStr) ?? resolveDropZone(over.data.current?.zone as string | undefined);

    const sorted = parseSortableZoneId(activeStr);
    if (sorted) {
      if (targetZone && targetZone !== sorted.zone) {
        removeFromAllZones(sorted.fieldId);
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

    const valueId = parseValueSortableId(activeStr);
    if (valueId) {
      if (targetZone && targetZone !== "values") {
        removeFromAllZones(valueId);
        onAddField(targetZone, valueId);
        return;
      }
      if (!onReorderValueFields) return;
      const overValue = parseValueSortableId(overStr);
      if (overValue) {
        const items = config.values.map((v) => v.fieldId);
        const oldIndex = items.indexOf(valueId);
        const newIndex = items.indexOf(overValue);
        if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
          onReorderValueFields(arrayMove(items, oldIndex, newIndex));
        }
      }
      return;
    }

    const fieldId = parsePaletteId(activeStr);
    if (!fieldId || !targetZone) return;
    const field = fieldMap.get(fieldId);
    if (!field) return;

    if (targetZone === "values") {
      if (field.dataType === "number" || field.dataType === "currency") onAddField(targetZone, fieldId);
      return;
    }
    if (targetZone === "reportFilters") {
      onAddField(targetZone, fieldId);
      return;
    }
    if (field.dataType === "string" || field.dataType === "date") onAddField(targetZone, fieldId);
  }

  const editingField = editingFieldId ? fieldMap.get(editingFieldId) : undefined;

  const overlayLabel = (() => {
    if (!activeId) return null;
    const palette = parsePaletteId(activeId);
    if (palette) return fieldMap.get(palette)?.label ?? palette;
    const sorted = parseSortableZoneId(activeId);
    if (sorted) return fieldMap.get(sorted.fieldId)?.label ?? sorted.fieldId;
    const value = parseValueSortableId(activeId);
    if (value) {
      const calc = config.calculatedMeasures?.find((m) => m.id === value);
      return calc?.label ?? fieldMap.get(value)?.label ?? value;
    }
    return null;
  })();

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={pivotFieldsCollisionDetection}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-3 pivot-builder-root">
        <aside className="pivot-field-list w-52 shrink-0 rounded-md border border-zinc-200 bg-zinc-50 p-2">
          <div className="mb-1 text-xs font-medium text-zinc-500">{t.zones.fields}</div>
          <div className="flex max-h-64 flex-wrap gap-1 overflow-y-auto sm:max-h-none">
            {fields.map((f) => (
              <FieldChip key={f.id} id={f.id} label={f.label} disabled={used.has(f.id)} />
            ))}
          </div>
        </aside>

        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
          <DropZone zone="reportFilters">
            <SortableContext
              items={config.reportFilters.map((id) => sortableZoneId("reportFilters", id))}
              strategy={verticalListSortingStrategy}
            >
              {config.reportFilters.map((id) => (
                <SortableHierarchyChip
                  key={id}
                  sortableId={sortableZoneId("reportFilters", id)}
                  label={fieldMap.get(id)?.label ?? id}
                  filter={filterMap.get(id)}
                  onConfigure={onSetFilter ? () => setEditingFieldId(id) : undefined}
                  onRemove={() => onRemoveField("reportFilters", id)}
                />
              ))}
            </SortableContext>
          </DropZone>
          <DropZone zone="columns">
            <SortableContext
              items={config.columns.map((id) => sortableZoneId("columns", id))}
              strategy={verticalListSortingStrategy}
            >
              {config.columns.map((id) => (
                <SortableHierarchyChip
                  key={id}
                  sortableId={sortableZoneId("columns", id)}
                  label={fieldMap.get(id)?.label ?? id}
                  filter={filterMap.get(id)}
                  onConfigure={onSetFilter ? () => setEditingFieldId(id) : undefined}
                  onRemove={() => onRemoveField("columns", id)}
                />
              ))}
            </SortableContext>
          </DropZone>
          <DropZone zone="rows">
            <SortableContext
              items={config.rows.map((id) => sortableZoneId("rows", id))}
              strategy={verticalListSortingStrategy}
            >
              {config.rows.map((id) => (
                <SortableHierarchyChip
                  key={id}
                  sortableId={sortableZoneId("rows", id)}
                  label={fieldMap.get(id)?.label ?? id}
                  filter={filterMap.get(id)}
                  onConfigure={onSetFilter ? () => setEditingFieldId(id) : undefined}
                  onRemove={() => onRemoveField("rows", id)}
                />
              ))}
            </SortableContext>
          </DropZone>
          <DropZone zone="values">
            <SortableContext
              items={config.values.map((v) => valueSortableId(v.fieldId))}
              strategy={verticalListSortingStrategy}
            >
              {config.values.map((v) => {
                const calc = config.calculatedMeasures?.find((m) => m.id === v.fieldId);
                return (
                  <SortableValueChip
                    key={v.fieldId}
                    sortableId={valueSortableId(v.fieldId)}
                    label={calc?.label ?? fieldMap.get(v.fieldId)?.label ?? v.fieldId}
                    aggregation={v.aggregation}
                    aggregations={AGGREGATIONS}
                    onUpdateAggregation={(agg) => onUpdateAggregation?.(v.fieldId, agg)}
                    onRemove={() => {
                      if (calc && onRemoveCalculatedMeasure) onRemoveCalculatedMeasure(v.fieldId);
                      onRemoveField("values", v.fieldId);
                    }}
                  />
                );
              })}
            </SortableContext>
            {onAddCalculatedPreset && (
              <div className="mt-1 flex flex-wrap gap-1 border-t border-dashed border-purple-200 pt-1">
                {getCalculatedMeasurePresets().map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    title={preset.description}
                    onClick={() => onAddCalculatedPreset(preset.id)}
                    className="rounded border border-purple-200 bg-white px-1.5 py-0.5 text-[10px] hover:bg-purple-50"
                  >
                    + {preset.label}
                  </button>
                ))}
              </div>
            )}
          </DropZone>
        </div>
      </div>

      {editingField && onSetFilter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 p-4">
          <div
            ref={filterDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={t.filters.filter}
            className="max-h-[90vh] overflow-auto"
          >
            <FilterEditor
              field={editingField}
              members={getFieldMembers(rawData, editingField.id)}
              allFields={fields}
              filter={filterMap.get(editingField.id)}
              onApply={(filter) => {
                onSetFilter(filter, editingField.id);
                setEditingFieldId(null);
              }}
              onClose={() => setEditingFieldId(null)}
            />
          </div>
        </div>
      )}

      <DragOverlay>
        {overlayLabel ? (
          <div className="rounded border bg-white px-2 py-1 text-xs shadow">{overlayLabel}</div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
