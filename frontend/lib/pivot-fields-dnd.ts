import {
  closestCenter,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  type Modifier
} from "@dnd-kit/core";
import { snapCenterToCursor } from "@dnd-kit/modifiers";

export type PivotBuilderZone = "rows" | "columns" | "values" | "reportFilters";

/** Keep DragOverlay under the pointer (fixes offset inside transformed dialogs). */
export const pivotDragOverlayModifiers: Modifier[] = [snapCenterToCursor];

const DATE_PART_ORDER = ["year", "quarter", "month", "week", "day"] as const;
type DatePart = (typeof DATE_PART_ORDER)[number];

export type DateHierarchyParsed = {
  groupKey: string;
  groupLabel: string;
  part: DatePart;
  partLabel: string;
};

/** Match WDR-style date levels: `order_date_year` / label `Дата заказа.Год`. */
export function parseDateHierarchyField(field: {
  id: string;
  label: string;
}): DateHierarchyParsed | null {
  const idMatch = field.id.match(/^(.*)_(year|quarter|month|week|day)$/i);
  if (!idMatch) return null;
  const groupKey = idMatch[1]!;
  const part = idMatch[2]!.toLowerCase() as DatePart;
  const dot = field.label.lastIndexOf(".");
  const groupLabel = dot > 0 ? field.label.slice(0, dot) : groupKey;
  const partLabel = dot > 0 ? field.label.slice(dot + 1) : part;
  return { groupKey, groupLabel, part, partLabel };
}

export type PivotPaletteDateGroup = {
  kind: "date-group";
  key: string;
  label: string;
  children: Array<{ field: { id: string; label: string }; partLabel: string; part: DatePart }>;
};

export type PivotPaletteFieldEntry = {
  kind: "field";
  field: { id: string; label: string };
};

export type PivotPaletteEntry = PivotPaletteDateGroup | PivotPaletteFieldEntry;

/** Date hierarchies first (WDR Fields list), then remaining fields in input order. */
export function buildPivotPaletteCatalog<T extends { id: string; label: string }>(
  fields: T[]
): Array<
  | { kind: "date-group"; key: string; label: string; children: Array<{ field: T; partLabel: string; part: DatePart }> }
  | { kind: "field"; field: T }
> {
  const groups = new Map<
    string,
    { label: string; children: Array<{ field: T; partLabel: string; part: DatePart }> }
  >();
  const rest: T[] = [];

  for (const field of fields) {
    const parsed = parseDateHierarchyField(field);
    if (!parsed) {
      rest.push(field);
      continue;
    }
    let group = groups.get(parsed.groupKey);
    if (!group) {
      group = { label: parsed.groupLabel, children: [] };
      groups.set(parsed.groupKey, group);
    }
    group.children.push({ field, partLabel: parsed.partLabel, part: parsed.part });
  }

  for (const group of groups.values()) {
    group.children.sort(
      (a, b) => DATE_PART_ORDER.indexOf(a.part) - DATE_PART_ORDER.indexOf(b.part)
    );
  }

  const dateEntries = [...groups.entries()].map(([key, group]) => ({
    kind: "date-group" as const,
    key,
    label: group.label,
    children: group.children
  }));

  return [...dateEntries, ...rest.map((field) => ({ kind: "field" as const, field }))];
}

export const PIVOT_DROP_ZONES: PivotBuilderZone[] = [
  "rows",
  "columns",
  "values",
  "reportFilters"
];

export const PALETTE_PREFIX = "palette:";
export const SORT_PREFIX = "sort:";
export const VALUE_SORT_PREFIX = "valsort:";
/** Virtual Σ Values chip — Rows ↔ Columns only. */
export const VALUES_AXIS_SORT_PREFIX = "valaxis:";
/** Stable drag id (zone lives in draft state / data.zone — not in the id). */
export const VALUES_AXIS_DRAG_ID = "valaxis:chip";
export const PIVOT_VALUES_AXIS_FIELD_ID = "__values__";
/** Drop slots for precise Σ insert index: `valinsert:rows:2`. */
export const VALUES_AXIS_INSERT_PREFIX = "valinsert:";

export type ZoneChipEntry =
  | { kind: "field"; fieldId: string }
  | { kind: "valuesAxis" };

export function valuesAxisInsertSlotId(zone: "rows" | "columns", index: number) {
  return `${VALUES_AXIS_INSERT_PREFIX}${zone}:${index}`;
}

export function parseValuesAxisInsertSlotId(
  id: string
): { zone: "rows" | "columns"; index: number } | null {
  if (!id.startsWith(VALUES_AXIS_INSERT_PREFIX)) return null;
  const rest = id.slice(VALUES_AXIS_INSERT_PREFIX.length);
  const sep = rest.indexOf(":");
  if (sep < 0) return null;
  const zone = rest.slice(0, sep);
  const index = Number(rest.slice(sep + 1));
  if (zone !== "rows" && zone !== "columns") return null;
  if (!Number.isFinite(index) || index < 0) return null;
  return { zone, index: Math.floor(index) };
}

export function clampValuesAxisIndex(index: number | undefined, fieldCount: number): number {
  if (index == null || Number.isNaN(index)) return fieldCount;
  return Math.min(Math.max(0, Math.floor(index)), fieldCount);
}

/** Build render / sort order for a zone including the optional Σ Values virtual chip. */
export function buildZoneChipOrder(
  fieldIds: readonly string[],
  includeValuesAxis: boolean,
  valuesAxisIndex?: number
): ZoneChipEntry[] {
  if (!includeValuesAxis) {
    return fieldIds.map((fieldId) => ({ kind: "field", fieldId }));
  }
  const idx = clampValuesAxisIndex(valuesAxisIndex, fieldIds.length);
  const order: ZoneChipEntry[] = [];
  for (let i = 0; i < fieldIds.length; i++) {
    if (i === idx) order.push({ kind: "valuesAxis" });
    order.push({ kind: "field", fieldId: fieldIds[i]! });
  }
  if (idx === fieldIds.length) order.push({ kind: "valuesAxis" });
  return order;
}

/** Field chips only — Σ Values uses useDraggable (not SortableContext). */
export function zoneChipSortableIds(
  zone: "rows" | "columns",
  order: readonly ZoneChipEntry[]
): string[] {
  return order
    .filter((entry) => entry.kind === "field")
    .map((entry) => sortableZoneId(zone, entry.fieldId));
}

export function splitZoneChipOrder(order: readonly ZoneChipEntry[]): {
  fieldIds: string[];
  valuesAxisIndex?: number;
} {
  const fieldIds: string[] = [];
  let valuesAxisIndex: number | undefined;
  for (const entry of order) {
    if (entry.kind === "valuesAxis") {
      valuesAxisIndex = fieldIds.length;
    } else {
      fieldIds.push(entry.fieldId);
    }
  }
  return valuesAxisIndex == null ? { fieldIds } : { fieldIds, valuesAxisIndex };
}

export type ValuesAxisDragResult =
  | {
      kind: "layout";
      position: "rows" | "columns";
      valuesAxisIndex: number;
    }
  | null;

/**
 * Insert index in field-space (0..fieldCount).
 * Insert slot → exact index.
 * Same-zone drop on field → move before/after so chip can travel up and down the list.
 * Empty / cross-zone bare zone → 0 or end.
 */
export function resolveValuesAxisInsertIndex(
  zone: "rows" | "columns",
  fieldIds: readonly string[],
  overId: string,
  sourceZone: "rows" | "columns",
  valuesAxisIndex?: number
): number {
  const insertSlot = parseValuesAxisInsertSlotId(overId);
  if (insertSlot?.zone === zone) {
    return clampValuesAxisIndex(insertSlot.index, fieldIds.length);
  }

  if (fieldIds.length === 0) return 0;

  if (overId === zoneDroppableId(zone) || overId === zone) {
    if (sourceZone === zone) {
      return clampValuesAxisIndex(valuesAxisIndex, fieldIds.length);
    }
    return fieldIds.length;
  }

  if (overId === VALUES_AXIS_DRAG_ID) {
    return clampValuesAxisIndex(valuesAxisIndex, fieldIds.length);
  }

  const overAxis = parseValuesAxisSortableId(overId);
  if (overAxis === zone) {
    return clampValuesAxisIndex(valuesAxisIndex, fieldIds.length);
  }

  const overSort = parseSortableZoneId(overId);
  if (overSort?.zone === zone) {
    const fieldIndex = fieldIds.indexOf(overSort.fieldId);
    if (fieldIndex < 0) return fieldIds.length;
    if (sourceZone !== zone) return fieldIndex;
    const oldIdx = clampValuesAxisIndex(valuesAxisIndex, fieldIds.length);
    // Pastga: maydon orqasiga; tepaga: maydon oldiga — ro‘yxatda erkin yurish.
    if (oldIdx <= fieldIndex) {
      return Math.min(fieldIndex + 1, fieldIds.length);
    }
    return fieldIndex;
  }

  return fieldIds.length;
}

/**
 * Resolve Σ Values chip drag end: cross-zone move or insert-at-index within zone.
 * `fromZone` is the chip's current axis (draft), not encoded in the drag id.
 */
export function resolveValuesAxisDragEnd(args: {
  fromZone: "rows" | "columns";
  overId: string;
  rows: readonly string[];
  columns: readonly string[];
  valuesAxisIndex?: number;
}): ValuesAxisDragResult {
  const fromZone = args.fromZone;
  const targetZone = resolveDropZone(args.overId);
  if (targetZone !== "rows" && targetZone !== "columns") return null;

  const targetFields = targetZone === "rows" ? args.rows : args.columns;
  const insertIndex = resolveValuesAxisInsertIndex(
    targetZone,
    targetFields,
    args.overId,
    fromZone,
    args.valuesAxisIndex
  );

  const prevIndex =
    fromZone === targetZone
      ? clampValuesAxisIndex(args.valuesAxisIndex, targetFields.length)
      : -1;
  if (fromZone === targetZone && prevIndex === insertIndex) return null;

  return {
    kind: "layout",
    position: targetZone,
    valuesAxisIndex: insertIndex
  };
}

export function zoneDroppableId(zone: PivotBuilderZone) {
  return `${zone}-zone`;
}

export function sortableZoneId(zone: "rows" | "columns" | "reportFilters", fieldId: string) {
  return `${SORT_PREFIX}${zone}:${fieldId}`;
}

export function valuesAxisSortableId(_zone?: "rows" | "columns") {
  return VALUES_AXIS_DRAG_ID;
}

/** True when `id` is the Σ Values draggable (stable id or legacy `valaxis:rows|columns`). */
export function isValuesAxisDragId(id: string): boolean {
  if (id === VALUES_AXIS_DRAG_ID) return true;
  return parseValuesAxisSortableId(id) != null;
}

export function parseValuesAxisSortableId(id: string): "rows" | "columns" | null {
  if (id === VALUES_AXIS_DRAG_ID) return null;
  if (!id.startsWith(VALUES_AXIS_SORT_PREFIX)) return null;
  const zone = id.slice(VALUES_AXIS_SORT_PREFIX.length);
  return zone === "rows" || zone === "columns" ? zone : null;
}

export function valueSortableId(fieldId: string) {
  return `${VALUE_SORT_PREFIX}${fieldId}`;
}

export function parsePaletteId(id: string): string | null {
  if (!id.startsWith(PALETTE_PREFIX)) return null;
  return id.slice(PALETTE_PREFIX.length) || null;
}

export function parseSortableZoneId(
  id: string
): { zone: "rows" | "columns" | "reportFilters"; fieldId: string } | null {
  if (!id.startsWith(SORT_PREFIX)) return null;
  const rest = id.slice(SORT_PREFIX.length);
  const sep = rest.indexOf(":");
  if (sep < 0) return null;
  const zone = rest.slice(0, sep);
  const fieldId = rest.slice(sep + 1);
  if (zone !== "rows" && zone !== "columns" && zone !== "reportFilters") return null;
  if (!fieldId) return null;
  return { zone, fieldId };
}

export function parseValueSortableId(id: string): string | null {
  if (!id.startsWith(VALUE_SORT_PREFIX)) return null;
  return id.slice(VALUE_SORT_PREFIX.length) || null;
}

/**
 * Resolve which pivot zone a dnd-kit `over.id` belongs to.
 * Handles bare zone droppables (`rows-zone`), nested chips
 * (`sort:rows:agent`, `valsort:amount`), and bare zone names from `data.zone`.
 */
export function resolveDropZone(overId: string | number | undefined | null): PivotBuilderZone | null {
  if (overId == null) return null;
  const overStr = String(overId);

  if ((PIVOT_DROP_ZONES as string[]).includes(overStr)) {
    return overStr as PivotBuilderZone;
  }

  if (overStr.endsWith("-zone")) {
    const zone = overStr.slice(0, -"-zone".length) as PivotBuilderZone;
    if (PIVOT_DROP_ZONES.includes(zone)) return zone;
    return null;
  }

  const sorted = parseSortableZoneId(overStr);
  if (sorted) return sorted.zone;

  const insertSlot = parseValuesAxisInsertSlotId(overStr);
  if (insertSlot) return insertSlot.zone;

  if (parseValuesAxisSortableId(overStr) || overStr === VALUES_AXIS_DRAG_ID) {
    // Bare chip id has no zone — caller must use data.zone / draft.
    return parseValuesAxisSortableId(overStr);
  }

  if (parseValueSortableId(overStr)) return "values";

  return null;
}

function preferValuesAxisCollision(
  hits: ReturnType<CollisionDetection>
): ReturnType<CollisionDetection> {
  const allowed = hits.filter((h) => {
    const id = String(h.id);
    if (id === VALUES_AXIS_DRAG_ID) return false;
    const zone = resolveDropZone(id);
    return zone === "rows" || zone === "columns";
  });
  if (allowed.length === 0) return hits;
  // 1) Exact insert slot (1st / 3rd / 5th position)
  const insert = allowed.find((h) => parseValuesAxisInsertSlotId(String(h.id)));
  if (insert) return [insert];
  // 2) Field chip (place before that field)
  const chip = allowed.find((h) => parseSortableZoneId(String(h.id)));
  if (chip) return [chip];
  // 3) Zone container (empty Rows/Columns)
  const zoneBox = allowed.find((h) => String(h.id).endsWith("-zone"));
  if (zoneBox) return [zoneBox];
  return [allowed[0]!];
}

/** Prefer pointer hits inside dialogs with nested zone+chip droppables. */
export const pivotFieldsCollisionDetection: CollisionDetection = (args) => {
  const isValuesAxis = isValuesAxisDragId(String(args.active.id));
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) {
    return isValuesAxis ? preferValuesAxisCollision(pointerHits) : pointerHits;
  }
  const rectHits = rectIntersection(args);
  if (rectHits.length > 0) {
    return isValuesAxis ? preferValuesAxisCollision(rectHits) : rectHits;
  }
  const closest = closestCenter(args);
  return isValuesAxis ? preferValuesAxisCollision(closest) : closest;
};

/** Normalize dnd-kit `over` to an id resolveDropZone understands. */
export function resolveOverIdForValuesAxis(
  overId: string | number | undefined | null,
  overDataZone?: unknown
): string | null {
  if (overId != null) {
    const raw = String(overId);
    if (resolveDropZone(raw) === "rows" || resolveDropZone(raw) === "columns") {
      return raw;
    }
  }
  if (overDataZone === "rows" || overDataZone === "columns") {
    return zoneDroppableId(overDataZone);
  }
  return overId != null ? String(overId) : null;
}
