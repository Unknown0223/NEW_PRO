import { type CollisionDetection } from "@dnd-kit/core";
export type PivotBuilderZone = "rows" | "columns" | "values" | "reportFilters";
export declare const PIVOT_DROP_ZONES: PivotBuilderZone[];
export declare const PALETTE_PREFIX = "palette:";
export declare const SORT_PREFIX = "sort:";
export declare const VALUE_SORT_PREFIX = "valsort:";
export declare function zoneDroppableId(zone: PivotBuilderZone): string;
export declare function sortableZoneId(zone: "rows" | "columns" | "reportFilters", fieldId: string): string;
export declare function valueSortableId(fieldId: string): string;
export declare function parsePaletteId(id: string): string | null;
export declare function parseSortableZoneId(id: string): {
    zone: "rows" | "columns" | "reportFilters";
    fieldId: string;
} | null;
export declare function parseValueSortableId(id: string): string | null;
export declare function resolveDropZone(overId: string | number | undefined | null): PivotBuilderZone | null;
export declare const pivotFieldsCollisionDetection: CollisionDetection;
//# sourceMappingURL=dnd.d.ts.map