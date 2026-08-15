import {
  closestCenter,
  pointerWithin,
  rectIntersection,
  type CollisionDetection
} from "@dnd-kit/core";

export type PivotBuilderZone = "rows" | "columns" | "values" | "reportFilters";

export const PIVOT_DROP_ZONES: PivotBuilderZone[] = [
  "rows",
  "columns",
  "values",
  "reportFilters"
];

export const PALETTE_PREFIX = "palette:";
export const SORT_PREFIX = "sort:";
export const VALUE_SORT_PREFIX = "valsort:";

export function zoneDroppableId(zone: PivotBuilderZone) {
  return `${zone}-zone`;
}

export function sortableZoneId(zone: "rows" | "columns" | "reportFilters", fieldId: string) {
  return `${SORT_PREFIX}${zone}:${fieldId}`;
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

  if (parseValueSortableId(overStr)) return "values";

  return null;
}

export const pivotFieldsCollisionDetection: CollisionDetection = (args) => {
  const pointerHits = pointerWithin(args);
  if (pointerHits.length > 0) return pointerHits;
  const rectHits = rectIntersection(args);
  if (rectHits.length > 0) return rectHits;
  return closestCenter(args);
};
