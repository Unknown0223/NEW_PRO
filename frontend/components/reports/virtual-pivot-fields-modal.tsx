"use client";

import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  MeasuringStrategy,
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
import { ChevronDown, ChevronRight, Plus, Search } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import type {
  AggregationType,
  CalculatedMeasure,
  PivotConfig,
  PivotField,
  PivotValuesPosition
} from "@salec/pivot-engine";
import { resolveValuesPosition } from "@salec/pivot-engine";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DemoApplyCancelBar } from "@/components/reports/demo-dialog-actions";
import { VirtualPivotCalculatedValueDialog } from "@/components/reports/virtual-pivot-calculated-value-dialog";
import {
  buildPivotPaletteCatalog,
  buildZoneChipOrder,
  isValuesAxisDragId,
  PALETTE_PREFIX,
  parsePaletteId,
  parseSortableZoneId,
  parseValueSortableId,
  pivotDragOverlayModifiers,
  pivotFieldsCollisionDetection,
  resolveDropZone,
  resolveOverIdForValuesAxis,
  resolveValuesAxisDragEnd,
  sortableZoneId,
  VALUES_AXIS_DRAG_ID,
  valueSortableId,
  valuesAxisInsertSlotId,
  zoneChipSortableIds,
  zoneDroppableId,
  type PivotBuilderZone,
  type ZoneChipEntry
} from "@/lib/pivot-fields-dnd";
import { cn } from "@/lib/utils";

type BuilderZone = PivotBuilderZone;

type Props = {
  open: boolean;
  schema: "compact" | "classic" | "flat";
  fields: PivotField[];
  config: PivotConfig;
  onAddField: (zone: BuilderZone, fieldId: string) => void;
  onRemoveField: (zone: BuilderZone, fieldId: string) => void;
  onUpdateAggregation?: (fieldId: string, aggregation: AggregationType) => void;
  onAddCalculatedPreset?: (presetId: string) => void;
  onAddCalculatedMeasure?: (measure: CalculatedMeasure) => void;
  onUpdateCalculatedMeasure?: (id: string, patch: Partial<Omit<CalculatedMeasure, "id">>) => void;
  onRemoveCalculatedMeasure?: (id: string) => void;
  onReorderFields?: (zone: "rows" | "columns" | "reportFilters", fieldIds: string[]) => void;
  /** Σ Values chip: Rows ↔ Columns (WDR Measures axis) + insert index. */
  onValuesAxisLayoutChange?: (layout: {
    position: PivotValuesPosition;
    valuesAxisIndex: number;
  }) => void;
  /** Flat: to‘liq ustun tartibi (rows + values birga). */
  onSetFlatColumnOrder?: (fieldIds: string[]) => void;
  /** Report Filters chip → member filter (WDR) */
  onConfigureFilter?: (fieldId: string) => void;
  filterSummaries?: Record<string, string | null>;
  onApply: () => void;
  onCancel: () => void;
};

const FLAT_PREFIX = "flat:";

/** Force light WDR palette even when app theme is dark. */
const LIGHT = {
  bg: "#ffffff",
  text: "#2b2b2b",
  muted: "#6b6b6b",
  border: "#d4d4d4",
  borderSoft: "#e8e8e8",
  chip: "#f0f0f0",
  chipBorder: "#c8c8c8",
  zoneBg: "#fafafa",
  apply: "#3a3a3a",
  placeholder: "#b0b0b0",
  headerBorder: "#e2e2e2"
} as const;

function usedFieldIds(config: PivotConfig): Set<string> {
  return new Set([
    ...config.rows,
    ...config.columns,
    ...config.reportFilters,
    ...config.values.map((v) => v.fieldId)
  ]);
}

function isNumeric(field?: PivotField) {
  if (!field) return false;
  if (field.dataType === "number" || field.dataType === "currency") return true;
  /** Bonus miqdori — har doim qiymat (Σ). */
  return field.id === "bonus_qty" || field.id === "block_qty";
}

function defaultZoneForField(field: PivotField): BuilderZone {
  return isNumeric(field) ? "values" : "rows";
}

function removeFromAllZones(
  config: PivotConfig,
  fieldId: string,
  onRemoveField: Props["onRemoveField"],
  onRemoveCalculatedMeasure?: Props["onRemoveCalculatedMeasure"]
) {
  if (config.reportFilters.includes(fieldId)) onRemoveField("reportFilters", fieldId);
  if (config.rows.includes(fieldId)) onRemoveField("rows", fieldId);
  if (config.columns.includes(fieldId)) onRemoveField("columns", fieldId);
  if (config.values.some((v) => v.fieldId === fieldId)) {
    onRemoveCalculatedMeasure?.(fieldId);
    onRemoveField("values", fieldId);
  }
}

function DragLines({ className }: { className?: string }) {
  return (
    <span className={cn("inline-flex w-3 flex-col justify-center gap-[3px]", className)} aria-hidden>
      <span className="block h-px w-full bg-[#9a9a9a]" />
      <span className="block h-px w-full bg-[#9a9a9a]" />
    </span>
  );
}

function ApplyCancelBar({
  onApply,
  onCancel,
  showCalculated,
  onAddCalculated
}: {
  onApply: () => void;
  onCancel: () => void;
  showCalculated?: boolean;
  onAddCalculated?: () => void;
}) {
  return (
    <DemoApplyCancelBar
      onApply={onApply}
      onCancel={onCancel}
      leading={
        showCalculated && onAddCalculated ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-8 gap-1 rounded-sm border-[#c8c8c8] bg-white text-[11px] text-[#2b2b2b] hover:bg-[#f7f7f7]"
            onClick={onAddCalculated}
          >
            <Plus className="h-3.5 w-3.5" />
            Добавить вычисленные…
          </Button>
        ) : null
      }
    />
  );
}

function FlatSortableRow({
  id,
  label,
  checked,
  onCheckedChange
}: {
  id: string;
  label: string;
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `${FLAT_PREFIX}${id}`,
    disabled: !checked
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        borderBottom: `1px solid ${LIGHT.borderSoft}`,
        background: isDragging ? "#f7f7f7" : LIGHT.bg,
        color: LIGHT.text
      }}
      className="flex items-center gap-2 px-3 py-2 text-[12px]"
    >
      <input
        type="checkbox"
        className="h-3.5 w-3.5 accent-[#555]"
        checked={checked}
        onChange={(e) => onCheckedChange(e.target.checked)}
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <button
        type="button"
        className={cn(
          "shrink-0 px-1",
          checked ? "cursor-grab active:cursor-grabbing" : "cursor-default opacity-30"
        )}
        aria-label="Переместить"
        disabled={!checked}
        {...attributes}
        {...listeners}
      >
        <DragLines />
      </button>
    </div>
  );
}

function PivotZoneBox({
  zone,
  title,
  empty,
  children
}: {
  zone: BuilderZone;
  title: string;
  empty: boolean;
  children: ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: zoneDroppableId(zone),
    data: { zone, type: "zone" }
  });
  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden"
      style={{
        border: `1px solid ${LIGHT.border}`,
        background: isOver ? "#e8f0fe" : LIGHT.zoneBg
      }}
    >
      <div
        className="shrink-0 px-2.5 py-1.5 text-[11px] font-semibold"
        style={{ color: LIGHT.text, borderBottom: `1px solid ${LIGHT.borderSoft}` }}
      >
        {title}
      </div>
      <div
        ref={setNodeRef}
        className="relative flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-contain p-2"
        data-zone={zone}
      >
        {children}
        {empty ? (
          <div
            className="pointer-events-none absolute inset-0 flex items-center justify-center px-3 text-center text-[11px]"
            style={{ color: LIGHT.placeholder }}
          >
            Перетащите поля сюда
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ZoneChip({
  id,
  label,
  onRemove,
  sortableId,
  sigma,
  aggregation,
  onAggregationChange,
  filterSummary,
  onConfigureFilter,
  formula,
  onEditFormula,
  hideRemove,
  dragZone
}: {
  id: string;
  label: string;
  onRemove?: () => void;
  sortableId?: string;
  sigma?: boolean;
  aggregation?: AggregationType;
  onAggregationChange?: (aggregation: AggregationType) => void;
  filterSummary?: string | null;
  onConfigureFilter?: () => void;
  formula?: string;
  onEditFormula?: () => void;
  hideRemove?: boolean;
  /** dnd-kit zone hint for nested droppables (e.g. Σ Values chip). */
  dragZone?: "rows" | "columns";
}) {
  const sortable = useSortable({
    id: sortableId ?? id,
    disabled: !sortableId,
    data: sortableId
      ? { type: "chip", fieldId: id, ...(dragZone ? { zone: dragZone } : {}) }
      : undefined
  });
  const style = {
    transform: sortableId ? CSS.Transform.toString(sortable.transform) : undefined,
    transition: sortableId ? sortable.transition : undefined,
    background: LIGHT.chip,
    border: `1px solid ${LIGHT.chipBorder}`,
    color: LIGHT.text
  };

  return (
    <div
      ref={sortableId ? sortable.setNodeRef : undefined}
      style={style}
      className={cn(
        "relative z-[1] flex w-full max-w-full items-center gap-1 rounded-sm px-1.5 py-1 text-[11px]",
        sortableId && "cursor-grab touch-none active:cursor-grabbing"
      )}
      {...(sortableId ? { ...sortable.attributes, ...sortable.listeners } : {})}
    >
      {sigma ? <span className="shrink-0 font-semibold text-[#555]">Σ</span> : null}
      <span className="min-w-0 flex-1 truncate" title={formula ? `${label}: ${formula}` : label}>
        {label}
        {formula ? <span className="mt-0.5 block truncate text-[9px] text-[#888]">{formula}</span> : null}
      </span>
      {formula && onEditFormula ? (
        <button
          type="button"
          className="shrink-0 rounded-sm px-1 text-[10px] text-[#1967d2] hover:bg-[#e8f0fe]"
          title="Изменить формулу"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onEditFormula();
          }}
        >
          ƒ
        </button>
      ) : null}
      {onConfigureFilter ? (
        <button
          type="button"
          className={cn(
            "shrink-0 rounded-sm px-1 text-[10px] hover:bg-[#e8e8e8]",
            filterSummary ? "bg-[#e8f0fe] text-[#1967d2]" : "text-[#888]"
          )}
          title={filterSummary ? `Фильтр: ${filterSummary}` : "Фильтр"}
          aria-label="Фильтр"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onConfigureFilter();
          }}
        >
          ▽{filterSummary ? ` ${filterSummary}` : ""}
        </button>
      ) : null}
      {sigma && onAggregationChange && aggregation ? (
        <select
          value={aggregation}
          onChange={(e) => onAggregationChange(e.target.value as AggregationType)}
          onPointerDown={(e) => e.stopPropagation()}
          className="h-5 max-w-[9rem] shrink-0 rounded-sm border bg-white px-0.5 text-[10px]"
          style={{ borderColor: LIGHT.border, color: LIGHT.text }}
          aria-label="Агрегация"
        >
          {([
            "SUM",
            "COUNT",
            "AVG",
            "MIN",
            "MAX",
            "COUNT_DISTINCT",
            "PERCENT_OF_TOTAL",
            "PERCENT_OF_ROW",
            "PERCENT_OF_COLUMN",
            "RUNNING_TOTAL",
            "PRODUCT",
            "INDEX",
            "DIFFERENCE"
          ] as AggregationType[]).map((agg) => (
            <option key={agg} value={agg}>
              {agg}
            </option>
          ))}
        </select>
      ) : null}
      <span className="shrink-0 px-0.5 text-[#888]" aria-hidden>
        <DragLines />
      </span>
      {!hideRemove && onRemove ? (
        <button
          type="button"
          className="shrink-0 px-0.5 text-[#888] hover:text-[#333]"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label="Убрать"
        >
          ×
        </button>
      ) : null}
    </div>
  );
}

function PaletteRow({
  field,
  checked,
  onToggle,
  displayLabel,
  indent
}: {
  field: PivotField;
  checked: boolean;
  onToggle: (next: boolean) => void;
  displayLabel?: string;
  indent?: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `${PALETTE_PREFIX}${field.id}`,
    data: { fieldId: field.id, type: "palette" }
  });
  const isValueField = isNumeric(field);

  return (
    <div
      className={cn(
        "flex items-center gap-2 py-1.5 text-[12px] hover:bg-[#f7f7f7]",
        indent ? "pl-7 pr-2.5" : "px-2.5"
      )}
      style={{
        borderBottom: `1px solid ${LIGHT.borderSoft}`,
        color: LIGHT.text,
        opacity: isDragging ? 0.5 : 1,
        background: LIGHT.bg
      }}
    >
      <input
        type="checkbox"
        className="h-3.5 w-3.5 accent-[#555]"
        checked={checked}
        onChange={(e) => onToggle(e.target.checked)}
      />
      <button
        ref={setNodeRef}
        type="button"
        className="flex min-w-0 flex-1 cursor-grab touch-none items-center gap-1.5 truncate text-left active:cursor-grabbing"
        {...listeners}
        {...attributes}
      >
        <DragLines className="shrink-0 opacity-70" />
        <span className="min-w-0 truncate">{displayLabel ?? field.label}</span>
      </button>
      {isValueField ? (
        <span
          className="w-4 shrink-0 text-center text-[13px] font-semibold leading-none text-[#555]"
          title="Значение"
          aria-label="Значение"
        >
          Σ
        </span>
      ) : null}
    </div>
  );
}

function DateHierarchyHeader({
  label,
  expanded,
  onToggle,
  checkedCount,
  childCount
}: {
  label: string;
  expanded: boolean;
  onToggle: () => void;
  checkedCount: number;
  childCount: number;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-left text-[12px] hover:bg-[#f7f7f7]"
      style={{
        borderBottom: `1px solid ${LIGHT.borderSoft}`,
        color: LIGHT.text,
        background: LIGHT.bg
      }}
      aria-expanded={expanded}
    >
      {expanded ? (
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-[#888]" />
      ) : (
        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#888]" />
      )}
      <span className="min-w-0 flex-1 truncate font-medium">{label}</span>
      {checkedCount > 0 ? (
        <span className="shrink-0 text-[10px] text-[#888]">
          {checkedCount}/{childCount}
        </span>
      ) : null}
    </button>
  );
}

function ValuesAxisInsertSlot({
  zone,
  index,
  visible
}: {
  zone: "rows" | "columns";
  index: number;
  /** Faqat Σ tortilayotganda ko‘rinadi — oddiy holatda bo‘shliq ochmaydi. */
  visible: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: valuesAxisInsertSlotId(zone, index),
    data: { type: "valuesAxisInsert", zone, index },
    disabled: !visible
  });
  if (!visible) {
    return <div ref={setNodeRef} className="pointer-events-none h-0 w-full overflow-hidden" />;
  }
  return (
    <div
      ref={setNodeRef}
      className="relative z-[3] w-full shrink-0 py-0.5"
      aria-hidden
    >
      <div
        className="mx-0.5 rounded-full transition-all"
        style={{
          height: isOver ? 4 : 2,
          background: isOver ? "#1967d2" : "rgba(25, 103, 210, 0.35)"
        }}
      />
    </div>
  );
}

function ValuesAxisChip({
  zone,
  onMoveToRows,
  onMoveToColumns
}: {
  zone: "rows" | "columns";
  onMoveToRows: () => void;
  onMoveToColumns: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: VALUES_AXIS_DRAG_ID,
    data: { type: "valuesAxis", zone }
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        background: isDragging ? "#e8f0fe" : LIGHT.chip,
        border: `1px solid ${isDragging ? "#1967d2" : LIGHT.chipBorder}`,
        color: LIGHT.text,
        opacity: isDragging ? 0.85 : 1,
        boxShadow: isDragging ? "0 4px 12px rgba(0,0,0,0.12)" : undefined
      }}
      className="relative z-[2] flex w-full max-w-full items-center gap-1 rounded-sm px-1.5 py-1.5 text-[11px]"
      aria-label="Σ Значения"
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 cursor-grab touch-none items-center gap-1.5 text-left active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <DragLines className="shrink-0 text-[#888]" />
        <span className="min-w-0 flex-1 truncate font-semibold">Σ Значения</span>
      </button>
      <div className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          disabled={zone === "rows"}
          className={cn(
            "rounded-sm px-1.5 py-0.5 text-[10px] font-medium",
            zone === "rows"
              ? "bg-[#1967d2] text-white"
              : "bg-[#e8f0fe] text-[#1967d2] hover:bg-[#d2e3fc]"
          )}
          title="Показать в рядах"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onMoveToRows();
          }}
        >
          Ряды
        </button>
        <button
          type="button"
          disabled={zone === "columns"}
          className={cn(
            "rounded-sm px-1.5 py-0.5 text-[10px] font-medium",
            zone === "columns"
              ? "bg-[#1967d2] text-white"
              : "bg-[#e8f0fe] text-[#1967d2] hover:bg-[#d2e3fc]"
          )}
          title="Показать в столбцах"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            onMoveToColumns();
          }}
        >
          Столбцы
        </button>
      </div>
    </div>
  );
}

function renderAxisZoneChips(
  zone: "rows" | "columns",
  order: ZoneChipEntry[],
  fieldMap: Map<string, PivotField>,
  onRemoveField: Props["onRemoveField"],
  filterSummaries: Props["filterSummaries"],
  onConfigureFilter: Props["onConfigureFilter"] | undefined,
  onMoveToRows: () => void,
  onMoveToColumns: () => void,
  showInsertSlots: boolean
) {
  const nodes: ReactNode[] = [];
  let fieldsBefore = 0;
  for (const entry of order) {
    nodes.push(
      <ValuesAxisInsertSlot
        key={`ins-${zone}-${fieldsBefore}-before-${entry.kind === "field" ? entry.fieldId : "v"}`}
        zone={zone}
        index={fieldsBefore}
        visible={showInsertSlots}
      />
    );
    if (entry.kind === "valuesAxis") {
      nodes.push(
        <ValuesAxisChip
          key={VALUES_AXIS_DRAG_ID}
          zone={zone}
          onMoveToRows={onMoveToRows}
          onMoveToColumns={onMoveToColumns}
        />
      );
    } else {
      const id = entry.fieldId;
      nodes.push(
        <ZoneChip
          key={id}
          id={id}
          label={fieldMap.get(id)?.label ?? id}
          sortableId={sortableZoneId(zone, id)}
          onRemove={() => onRemoveField(zone, id)}
          filterSummary={filterSummaries?.[id] ?? null}
          onConfigureFilter={onConfigureFilter ? () => onConfigureFilter(id) : undefined}
          dragZone={zone}
        />
      );
      fieldsBefore += 1;
    }
  }
  nodes.push(
    <ValuesAxisInsertSlot
      key={`ins-${zone}-end`}
      zone={zone}
      index={fieldsBefore}
      visible={showInsertSlots}
    />
  );
  return nodes;
}

export function VirtualPivotFieldsModal({
  open,
  schema,
  fields,
  config,
  onAddField,
  onRemoveField,
  onUpdateAggregation,
  onAddCalculatedPreset: _onAddCalculatedPreset,
  onAddCalculatedMeasure,
  onUpdateCalculatedMeasure,
  onRemoveCalculatedMeasure,
  onReorderFields,
  onValuesAxisLayoutChange,
  onSetFlatColumnOrder,
  onConfigureFilter,
  filterSummaries,
  onApply,
  onCancel
}: Props) {
  const [search, setSearch] = useState("");
  const [activeDragLabel, setActiveDragLabel] = useState<string | null>(null);
  /** Last valid Rows/Columns over id while dragging Σ Значения (drop flicker fallback). */
  const lastValuesAxisOverRef = useRef<string | null>(null);
  /**
   * Draft Σ axis — modal ichida saqlanadi, parent/pivot faqat Apply da yangilanadi
   * (har dropda qayta hisoblash UI ni og‘irlashtirardi va DnD ni «qotirardi»).
   */
  const [draftValuesPosition, setDraftValuesPosition] = useState<PivotValuesPosition>("columns");
  const [draftValuesAxisIndex, setDraftValuesAxisIndex] = useState<number | undefined>(undefined);
  const draftDirtyRef = useRef(false);
  const [valuesAxisDragging, setValuesAxisDragging] = useState(false);
  /** Manual expand overrides; undefined = auto from used status. */
  const [dateExpandOverrides, setDateExpandOverrides] = useState<Record<string, boolean>>({});
  const [calcOpen, setCalcOpen] = useState(false);
  const [editingCalcId, setEditingCalcId] = useState<string | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));
  const used = usedFieldIds(config);
  const fieldMap = useMemo(() => new Map(fields.map((f) => [f.id, f])), [fields]);
  const isFlat = schema === "flat";
  const showValuesAxisChip = !isFlat && config.values.length > 0;

  useEffect(() => {
    if (!open) {
      draftDirtyRef.current = false;
      return;
    }
    setDraftValuesPosition(resolveValuesPosition(config.options));
    setDraftValuesAxisIndex(config.options.valuesAxisIndex);
    draftDirtyRef.current = false;
    setDateExpandOverrides({});
    // Faqat modal ochilganda sync — config o‘zgarsa draftni qayta yozmasin.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional open-edge sync
  }, [open]);

  const columnChipOrder = useMemo(
    () =>
      buildZoneChipOrder(
        config.columns,
        showValuesAxisChip && draftValuesPosition === "columns",
        draftValuesAxisIndex
      ),
    [config.columns, draftValuesAxisIndex, showValuesAxisChip, draftValuesPosition]
  );

  const rowChipOrder = useMemo(
    () =>
      buildZoneChipOrder(
        config.rows,
        showValuesAxisChip && draftValuesPosition === "rows",
        draftValuesAxisIndex
      ),
    [config.rows, draftValuesAxisIndex, showValuesAxisChip, draftValuesPosition]
  );

  const canAddCalculated = !isFlat && Boolean(onAddCalculatedMeasure);

  function flushValuesAxisDraft() {
    if (!draftDirtyRef.current || !onValuesAxisLayoutChange) return;
    const axisFields =
      draftValuesPosition === "rows" ? config.rows : config.columns;
    onValuesAxisLayoutChange({
      position: draftValuesPosition,
      valuesAxisIndex:
        draftValuesAxisIndex ?? axisFields.length
    });
    draftDirtyRef.current = false;
  }

  function handleApply() {
    flushValuesAxisDraft();
    onApply();
  }

  function handleCancel() {
    draftDirtyRef.current = false;
    onCancel();
  }

  function moveValuesAxisToRows() {
    setDraftValuesPosition("rows");
    setDraftValuesAxisIndex(config.rows.length);
    draftDirtyRef.current = true;
  }

  function moveValuesAxisToColumns() {
    setDraftValuesPosition("columns");
    setDraftValuesAxisIndex(config.columns.length);
    draftDirtyRef.current = true;
  }

  const filteredFields = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return fields;
    return fields.filter((f) => f.label.toLowerCase().includes(q) || f.id.toLowerCase().includes(q));
  }, [fields, search]);

  const paletteCatalog = useMemo(
    () => buildPivotPaletteCatalog(filteredFields),
    [filteredFields]
  );

  const flatOrderedIds = useMemo(() => {
    const ordered = [
      ...config.rows,
      ...config.columns,
      ...config.values.map((v) => v.fieldId)
    ];
    const seen = new Set<string>();
    const selected: string[] = [];
    for (const id of ordered) {
      if (!seen.has(id) && used.has(id)) {
        seen.add(id);
        selected.push(id);
      }
    }
    for (const f of fields) {
      if (!seen.has(f.id)) selected.push(f.id);
    }
    return selected;
  }, [config, fields, used]);

  const flatVisible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return flatOrderedIds
      .map((id) => fieldMap.get(id))
      .filter((f): f is PivotField => Boolean(f))
      .filter((f) => !q || f.label.toLowerCase().includes(q) || f.id.toLowerCase().includes(q));
  }, [flatOrderedIds, fieldMap, search]);

  const selectAllTargets = isFlat ? flatVisible : filteredFields;
  const allChecked =
    selectAllTargets.length > 0 && selectAllTargets.every((f) => used.has(f.id));
  const someChecked = selectAllTargets.some((f) => used.has(f.id));

  function toggleField(field: PivotField, next: boolean) {
    if (next) {
      const zone = isFlat ? "rows" : defaultZoneForField(field);
      if (!used.has(field.id)) {
        onAddField(zone, field.id);
        return;
      }
      // Allaqachon «Ряды»da bo‘lsa-yu qiymat maydoni bo‘lsa — Значения ga ko‘chir.
      if (!isFlat && zone === "values" && config.rows.includes(field.id)) {
        onRemoveField("rows", field.id);
        if (!config.values.some((v) => v.fieldId === field.id)) onAddField("values", field.id);
      }
      return;
    }
    removeFromAllZones(config, field.id, onRemoveField, onRemoveCalculatedMeasure);
  }

  function toggleSelectAll(next: boolean) {
    const list = isFlat ? flatVisible : filteredFields;
    if (next) {
      for (const f of list) {
        if (!used.has(f.id)) onAddField(isFlat ? "rows" : defaultZoneForField(f), f.id);
      }
      return;
    }
    for (const f of list) {
      if (used.has(f.id)) removeFromAllZones(config, f.id, onRemoveField, onRemoveCalculatedMeasure);
    }
  }

  function openCalculated(editId?: string) {
    setEditingCalcId(editId ?? null);
    setCalcOpen(true);
  }

  function placeFieldInZone(fieldId: string, zone: BuilderZone) {
    removeFromAllZones(config, fieldId, onRemoveField, onRemoveCalculatedMeasure);
    onAddField(zone, fieldId);
  }

  function handleFlatDragEnd(e: DragEndEvent) {
    setActiveDragLabel(null);
    const { active, over } = e;
    if (!over) return;
    const a = String(active.id).replace(FLAT_PREFIX, "");
    const b = String(over.id).replace(FLAT_PREFIX, "");
    if (a === b) return;
    const checked = flatOrderedIds.filter((id) => used.has(id));
    const oldIndex = checked.indexOf(a);
    const newIndex = checked.indexOf(b);
    if (oldIndex < 0 || newIndex < 0) return;
    const nextChecked = arrayMove(checked, oldIndex, newIndex);
    if (onSetFlatColumnOrder) {
      onSetFlatColumnOrder(nextChecked);
      return;
    }
    if (onReorderFields) onReorderFields("rows", nextChecked);
  }

  function handlePivotDragEnd(e: DragEndEvent) {
    setActiveDragLabel(null);
    setValuesAxisDragging(false);
    const { active, over } = e;
    const activeStr = String(active.id);
    const overStr = over ? String(over.id) : null;
    const targetZone = over
      ? resolveDropZone(overStr) ??
        resolveDropZone(over.data.current?.zone as string | undefined)
      : null;

    const fromValuesAxis = isValuesAxisDragId(activeStr);
    if (fromValuesAxis) {
      const resolvedOverId =
        (over
          ? resolveOverIdForValuesAxis(overStr, over.data.current?.zone)
          : null) ?? lastValuesAxisOverRef.current;
      lastValuesAxisOverRef.current = null;
      if (!resolvedOverId) return;
      const layout = resolveValuesAxisDragEnd({
        fromZone: draftValuesPosition,
        overId: resolvedOverId,
        rows: config.rows,
        columns: config.columns,
        valuesAxisIndex: draftValuesAxisIndex
      });
      if (layout) {
        setDraftValuesPosition(layout.position);
        setDraftValuesAxisIndex(layout.valuesAxisIndex);
        draftDirtyRef.current = true;
      }
      return;
    }

    if (!over || !overStr) return;

    const fromSort = parseSortableZoneId(activeStr);
    if (fromSort) {
      if (targetZone && targetZone !== fromSort.zone) {
        placeFieldInZone(fromSort.fieldId, targetZone);
        return;
      }
      if (!onReorderFields) return;
      const overSort = parseSortableZoneId(overStr);
      if (!overSort || overSort.zone !== fromSort.zone) return;
      const items = [...config[fromSort.zone]];
      const oldIndex = items.indexOf(fromSort.fieldId);
      const newIndex = items.indexOf(overSort.fieldId);
      if (oldIndex >= 0 && newIndex >= 0 && oldIndex !== newIndex) {
        onReorderFields(fromSort.zone, arrayMove(items, oldIndex, newIndex));
      }
      return;
    }

    const fromValue = parseValueSortableId(activeStr);
    if (fromValue) {
      if (targetZone && targetZone !== "values") {
        placeFieldInZone(fromValue, targetZone);
      }
      return;
    }

    const fieldId = parsePaletteId(activeStr);
    if (!fieldId || !targetZone) return;
    if (!fieldMap.has(fieldId)) return;
    placeFieldInZone(fieldId, targetZone);
  }

  const overlay = (
    <DragOverlay dropAnimation={null} modifiers={pivotDragOverlayModifiers}>
      {activeDragLabel ? (
        <div
          className="rounded-sm border px-2 py-1 text-[12px] shadow-lg"
          style={{ background: LIGHT.bg, borderColor: LIGHT.border, color: LIGHT.text }}
        >
          {activeDragLabel}
        </div>
      ) : null}
    </DragOverlay>
  );

  function isDateGroupExpanded(
    key: string,
    children: Array<{ field: PivotField }>,
    searching: boolean
  ): boolean {
    if (searching) return true;
    if (key in dateExpandOverrides) return dateExpandOverrides[key]!;
    return children.some((c) => used.has(c.field.id));
  }

  function toggleDateGroup(key: string, children: Array<{ field: PivotField }>) {
    const searching = search.trim().length > 0;
    const currently = isDateGroupExpanded(key, children, searching);
    setDateExpandOverrides((prev) => ({ ...prev, [key]: !currently }));
  }

  return (
    <>
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) handleCancel();
      }}
    >
      <DialogContent
        showCloseButton={false}
        overlayClassName={cn(
          "!bg-black/40 !backdrop-blur-[1px]",
          /* Calculated Value dialog stacks above Fields (z-80). */
          calcOpen && "!pointer-events-none !opacity-40"
        )}
        className={cn(
          "!gap-0 !rounded-sm !border !p-0 !shadow-2xl !ring-0 sm:!max-w-none",
          /* Markaz: inset+margin (transform YO‘Q — dnd-kit DropOverlay buzilmasin). */
          "!inset-0 !left-0 !right-0 !top-0 !bottom-0 !m-auto !h-fit !max-h-[min(90vh,720px)]",
          "!translate-x-0 !translate-y-0 !transform-none",
          "data-open:!animate-none data-closed:!animate-none !duration-0",
          "overflow-hidden",
          isFlat
            ? "!w-[540px] max-w-[calc(100%-1rem)] sm:max-w-[calc(100%-2rem)]"
            : "!w-[min(880px,100%)] max-w-[calc(100%-1rem)] sm:max-w-[calc(100%-2rem)]",
          calcOpen && "!pointer-events-none !opacity-50"
        )}
        style={{
          backgroundColor: LIGHT.bg,
          color: LIGHT.text,
          borderColor: LIGHT.border,
          transform: "none"
        }}
        aria-hidden={calcOpen || undefined}
      >
        {/* Visually hidden for a11y — visible title is custom */}
        <DialogTitle className="sr-only">Поля</DialogTitle>

        <div
          className="flex items-center justify-between gap-3 px-4 py-3"
          style={{ borderBottom: `1px solid ${LIGHT.headerBorder}`, background: LIGHT.bg }}
        >
          <div className="min-w-0">
            <div className="text-[15px] font-semibold" style={{ color: LIGHT.text }}>
              Поля
            </div>
          </div>
          <ApplyCancelBar
            onApply={handleApply}
            onCancel={handleCancel}
            showCalculated={canAddCalculated}
            onAddCalculated={() => openCalculated()}
          />
        </div>

        {isFlat ? (
          <div className="px-4 pb-4 pt-3" style={{ background: LIGHT.bg }}>
            <div
              className="mb-2 flex items-center gap-3 pb-2"
              style={{ borderBottom: `1px solid ${LIGHT.borderSoft}` }}
            >
              <label className="flex cursor-pointer items-center gap-2 text-[12px]" style={{ color: LIGHT.text }}>
                <input
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-[#555]"
                  checked={allChecked}
                  ref={(el) => {
                    if (el) el.indeterminate = !allChecked && someChecked;
                  }}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                />
                Все
              </label>
              <div className="relative ml-auto">
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск"
                  className="h-7 w-44 rounded-sm border bg-white py-1 pl-2 pr-8 text-[12px] outline-none"
                  style={{ borderColor: LIGHT.border, color: LIGHT.text }}
                />
                <Search className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#999]" />
              </div>
            </div>

            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragStart={(e) => {
                const id = String(e.active.id).replace(FLAT_PREFIX, "");
                setActiveDragLabel(fieldMap.get(id)?.label ?? id);
              }}
              onDragEnd={handleFlatDragEnd}
              onDragCancel={() => setActiveDragLabel(null)}
            >
              <SortableContext
                items={flatVisible.map((f) => `${FLAT_PREFIX}${f.id}`)}
                strategy={verticalListSortingStrategy}
              >
                <div
                  className="max-h-[48vh] overflow-auto"
                  style={{ border: `1px solid ${LIGHT.border}`, background: LIGHT.bg }}
                >
                  {flatVisible.map((field) => (
                    <FlatSortableRow
                      key={field.id}
                      id={field.id}
                      label={field.label}
                      checked={used.has(field.id)}
                      onCheckedChange={(next) => toggleField(field, next)}
                    />
                  ))}
                </div>
              </SortableContext>
              {overlay}
            </DndContext>
          </div>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={pivotFieldsCollisionDetection}
            measuring={{ droppable: { strategy: MeasuringStrategy.WhileDragging } }}
            onDragStart={(e) => {
              const raw = String(e.active.id);
              lastValuesAxisOverRef.current = null;
              if (isValuesAxisDragId(raw)) {
                setValuesAxisDragging(true);
                setActiveDragLabel("Σ Значения");
                return;
              }
              setValuesAxisDragging(false);
              const paletteId = parsePaletteId(raw);
              const sortId = parseSortableZoneId(raw);
              const valueId = parseValueSortableId(raw);
              const id = paletteId ?? sortId?.fieldId ?? valueId ?? raw;
              setActiveDragLabel(fieldMap.get(id)?.label ?? id);
            }}
            onDragOver={(e) => {
              if (!isValuesAxisDragId(String(e.active.id)) || !e.over) return;
              const id = resolveOverIdForValuesAxis(
                String(e.over.id),
                e.over.data.current?.zone
              );
              if (!id) return;
              const zone = resolveDropZone(id);
              if (zone === "rows" || zone === "columns") {
                lastValuesAxisOverRef.current = id;
              }
            }}
            onDragEnd={handlePivotDragEnd}
            onDragCancel={() => {
              lastValuesAxisOverRef.current = null;
              setValuesAxisDragging(false);
              setActiveDragLabel(null);
            }}
          >
            <div
              className="grid h-[440px] gap-0"
              style={{
                gridTemplateColumns: "260px 1fr",
                background: LIGHT.bg
              }}
            >
              <div
                className="flex min-h-0 flex-col"
                style={{ borderRight: `1px solid ${LIGHT.border}`, background: LIGHT.bg }}
              >
                <div className="shrink-0 space-y-2 p-2" style={{ borderBottom: `1px solid ${LIGHT.borderSoft}` }}>
                  <label
                    className="flex cursor-pointer items-center gap-2 text-[12px] font-medium"
                    style={{ color: LIGHT.text }}
                  >
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-[#555]"
                      checked={allChecked}
                      ref={(el) => {
                        if (el) el.indeterminate = !allChecked && someChecked;
                      }}
                      onChange={(e) => toggleSelectAll(e.target.checked)}
                    />
                    Все
                  </label>
                  <div className="relative">
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Поиск полей"
                      className="h-8 w-full rounded-sm border bg-white py-1 pl-2 pr-8 text-[12px] outline-none"
                      style={{ borderColor: LIGHT.border, color: LIGHT.text }}
                    />
                    <Search className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#999]" />
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-auto" style={{ background: LIGHT.bg }}>
                  {paletteCatalog.map((entry) => {
                    if (entry.kind === "date-group") {
                      const searching = search.trim().length > 0;
                      const expanded = isDateGroupExpanded(entry.key, entry.children, searching);
                      const checkedCount = entry.children.filter((c) => used.has(c.field.id)).length;
                      return (
                        <div key={entry.key}>
                          <DateHierarchyHeader
                            label={entry.label}
                            expanded={expanded}
                            onToggle={() => toggleDateGroup(entry.key, entry.children)}
                            checkedCount={checkedCount}
                            childCount={entry.children.length}
                          />
                          {expanded
                            ? entry.children.map(({ field, partLabel }) => (
                                <PaletteRow
                                  key={field.id}
                                  field={field}
                                  displayLabel={partLabel}
                                  indent
                                  checked={used.has(field.id)}
                                  onToggle={(next) => toggleField(field, next)}
                                />
                              ))
                            : null}
                        </div>
                      );
                    }
                    return (
                      <PaletteRow
                        key={entry.field.id}
                        field={entry.field}
                        checked={used.has(entry.field.id)}
                        onToggle={(next) => toggleField(entry.field, next)}
                      />
                    );
                  })}
                </div>
              </div>

              <div
                className="grid h-full min-h-0 min-w-0"
                style={{
                  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
                  gridTemplateRows: "minmax(0, 1fr) minmax(0, 1fr)",
                  background: LIGHT.bg
                }}
              >
                <PivotZoneBox zone="reportFilters" title="Фильтры отчета" empty={config.reportFilters.length === 0}>
                  <SortableContext
                    items={config.reportFilters.map((id) => sortableZoneId("reportFilters", id))}
                    strategy={verticalListSortingStrategy}
                  >
                    {config.reportFilters.map((id) => (
                      <ZoneChip
                        key={id}
                        id={id}
                        label={fieldMap.get(id)?.label ?? id}
                        sortableId={sortableZoneId("reportFilters", id)}
                        onRemove={() => onRemoveField("reportFilters", id)}
                        filterSummary={filterSummaries?.[id] ?? null}
                        onConfigureFilter={
                          onConfigureFilter ? () => onConfigureFilter(id) : undefined
                        }
                      />
                    ))}
                  </SortableContext>
                </PivotZoneBox>

                <PivotZoneBox
                  zone="columns"
                  title="Столбцы"
                  empty={columnChipOrder.length === 0}
                >
                  <SortableContext
                    items={zoneChipSortableIds("columns", columnChipOrder)}
                    strategy={verticalListSortingStrategy}
                  >
                    {renderAxisZoneChips(
                      "columns",
                      columnChipOrder,
                      fieldMap,
                      onRemoveField,
                      filterSummaries,
                      onConfigureFilter,
                      moveValuesAxisToRows,
                      moveValuesAxisToColumns,
                      valuesAxisDragging
                    )}
                  </SortableContext>
                </PivotZoneBox>

                <PivotZoneBox
                  zone="rows"
                  title="Ряды"
                  empty={rowChipOrder.length === 0}
                >
                  <SortableContext
                    items={zoneChipSortableIds("rows", rowChipOrder)}
                    strategy={verticalListSortingStrategy}
                  >
                    {renderAxisZoneChips(
                      "rows",
                      rowChipOrder,
                      fieldMap,
                      onRemoveField,
                      filterSummaries,
                      onConfigureFilter,
                      moveValuesAxisToRows,
                      moveValuesAxisToColumns,
                      valuesAxisDragging
                    )}
                  </SortableContext>
                </PivotZoneBox>

                <PivotZoneBox zone="values" title="Значения" empty={config.values.length === 0}>
                  <SortableContext
                    items={config.values.map((v) => valueSortableId(v.fieldId))}
                    strategy={verticalListSortingStrategy}
                  >
                    {config.values.map((v) => {
                      const calc = config.calculatedMeasures?.find((m) => m.id === v.fieldId);
                      return (
                        <ZoneChip
                          key={v.fieldId}
                          id={v.fieldId}
                          label={calc?.label ?? fieldMap.get(v.fieldId)?.label ?? v.fieldId}
                          sortableId={valueSortableId(v.fieldId)}
                          sigma
                          formula={calc?.formula}
                          onEditFormula={
                            calc && (onUpdateCalculatedMeasure || onAddCalculatedMeasure)
                              ? () => openCalculated(calc.id)
                              : undefined
                          }
                          aggregation={v.aggregation}
                          onAggregationChange={
                            onUpdateAggregation
                              ? (agg) => onUpdateAggregation(v.fieldId, agg)
                              : undefined
                          }
                          onRemove={() => {
                            if (calc && onRemoveCalculatedMeasure) onRemoveCalculatedMeasure(v.fieldId);
                            onRemoveField("values", v.fieldId);
                          }}
                        />
                      );
                    })}
                  </SortableContext>
                </PivotZoneBox>
              </div>
            </div>
            {overlay}
          </DndContext>
        )}
      </DialogContent>
    </Dialog>

    <VirtualPivotCalculatedValueDialog
      open={calcOpen}
      onOpenChange={(next) => {
        setCalcOpen(next);
        if (!next) setEditingCalcId(null);
      }}
      fields={fields}
      calculatedMeasures={config.calculatedMeasures}
      editing={
        editingCalcId
          ? (config.calculatedMeasures?.find((m) => m.id === editingCalcId) ?? null)
          : null
      }
      onAdd={(measure) => {
        onAddCalculatedMeasure?.(measure);
      }}
      onUpdate={(id, patch) => {
        onUpdateCalculatedMeasure?.(id, patch);
      }}
    />
    </>
  );
}
