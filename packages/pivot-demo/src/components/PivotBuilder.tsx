import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors
} from "@dnd-kit/core";
import type { AggregationType, PivotConfig, PivotField, PivotFilter } from "@salec/pivot-engine";
import { getCalculatedMeasurePresets, getFieldMembers, getPivotStrings } from "@salec/pivot-engine";
import { Filter, GripVertical, X } from "lucide-react";
import { useMemo, useState } from "react";
import { FilterEditor } from "./filters/FilterEditor";
import { cn } from "@/lib/cn";

type Zone = "rows" | "columns" | "values" | "reportFilters";

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
};

const PALETTE_PREFIX = "palette:";

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
  const { setNodeRef, isOver } = useDroppable({ id: `${zone}-zone` });
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

export function PivotBuilder({
  fields,
  config,
  rawData,
  onAddField,
  onRemoveField,
  onUpdateAggregation,
  onSetFilter,
  onAddCalculatedPreset,
  onRemoveCalculatedMeasure
}: Props) {
  const t = getPivotStrings();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [editingFieldId, setEditingFieldId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const fieldMap = new Map(fields.map((f) => [f.id, f]));
  const filterMap = useMemo(() => new Map(config.filters.map((f) => [f.fieldId, f])), [config.filters]);
  const used = usedIds(config);

  function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over || !String(active.id).startsWith(PALETTE_PREFIX)) return;
    const fieldId = String(active.id).slice(PALETTE_PREFIX.length);
    const zone = String(over.id).replace("-zone", "") as Zone;
    const field = fieldMap.get(fieldId);
    if (!field) return;

    if (zone === "values") {
      if (field.dataType === "number" || field.dataType === "currency") onAddField(zone, fieldId);
      return;
    }
    if (zone === "reportFilters") {
      onAddField(zone, fieldId);
      return;
    }
    if (field.dataType === "string" || field.dataType === "date") onAddField(zone, fieldId);
  }

  const editingField = editingFieldId ? fieldMap.get(editingFieldId) : undefined;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="flex gap-3">
        <aside className="w-52 shrink-0 rounded-md border border-zinc-200 bg-zinc-50 p-2">
          <div className="mb-1 text-xs font-medium text-zinc-500">{t.zones.fields}</div>
          <div className="flex flex-wrap gap-1">
            {fields.map((f) => (
              <FieldChip key={f.id} id={f.id} label={f.label} disabled={used.has(f.id)} />
            ))}
          </div>
        </aside>

        <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-2">
          <DropZone zone="reportFilters">
            {config.reportFilters.map((id) => (
              <div key={id} className="mb-1 flex items-center gap-1 rounded border bg-white px-1 py-0.5 text-xs">
                <span className="flex-1 truncate">{fieldMap.get(id)?.label ?? id}</span>
                <button type="button" onClick={() => setEditingFieldId(id)} className="rounded p-0.5 hover:bg-zinc-100">
                  <Filter className="h-3 w-3" />
                </button>
                <button type="button" onClick={() => onRemoveField("reportFilters", id)}>
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </DropZone>
          <DropZone zone="columns">
            {config.columns.map((id) => (
              <HierarchyChip
                key={id}
                label={fieldMap.get(id)?.label ?? id}
                filter={filterMap.get(id)}
                onConfigure={onSetFilter ? () => setEditingFieldId(id) : undefined}
                onRemove={() => onRemoveField("columns", id)}
              />
            ))}
          </DropZone>
          <DropZone zone="rows">
            {config.rows.map((id) => (
              <HierarchyChip
                key={id}
                label={fieldMap.get(id)?.label ?? id}
                filter={filterMap.get(id)}
                onConfigure={onSetFilter ? () => setEditingFieldId(id) : undefined}
                onRemove={() => onRemoveField("rows", id)}
              />
            ))}
          </DropZone>
          <DropZone zone="values">
            {config.values.map((v) => {
              const calc = config.calculatedMeasures?.find((m) => m.id === v.fieldId);
              return (
                <div key={v.fieldId} className="mb-1 flex items-center gap-1 rounded border bg-white px-1 py-0.5 text-xs">
                  <span className="truncate">{calc?.label ?? fieldMap.get(v.fieldId)?.label ?? v.fieldId}</span>
                  <select
                    value={v.aggregation}
                    onChange={(e) => onUpdateAggregation?.(v.fieldId, e.target.value as AggregationType)}
                    className="h-5 rounded border text-[10px]"
                  >
                    {[
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
                    ].map((a) => (
                      <option key={a} value={a}>
                        {t.aggregations[a as AggregationType]}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      if (calc && onRemoveCalculatedMeasure) onRemoveCalculatedMeasure(v.fieldId);
                      onRemoveField("values", v.fieldId);
                    }}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              );
            })}
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
      )}

      <DragOverlay>
        {activeId ? (
          <div className="rounded border bg-white px-2 py-1 text-xs shadow">
            {fieldMap.get(activeId.slice(PALETTE_PREFIX.length))?.label}
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function HierarchyChip({
  label,
  filter,
  onConfigure,
  onRemove
}: {
  label: string;
  filter?: PivotFilter;
  onConfigure?: () => void;
  onRemove: () => void;
}) {
  return (
    <div className="mb-1 flex items-center gap-1 rounded border bg-white px-1 py-0.5 text-xs">
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
