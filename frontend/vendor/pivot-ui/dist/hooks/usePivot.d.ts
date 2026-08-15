import { type AggregationType, type PivotCell, type PivotConfig, type PivotData, type PivotField, type PivotFilter } from "@salec/pivot-engine";
type BuilderZone = "rows" | "columns" | "values" | "reportFilters";
type UsePivotOptions = {
    initialConfig?: Partial<PivotConfig>;
    workerThreshold?: number;
    useWorker?: boolean;
};
export declare function usePivot(rawData: Record<string, unknown>[], fields: PivotField[], options?: UsePivotOptions): {
    config: PivotConfig;
    pivotData: PivotData | null;
    isComputing: boolean;
    usingWorker: boolean;
    expandedRows: Set<string>;
    drillOpen: boolean;
    drillRecords: Record<string, unknown>[];
    drillCell: PivotCell | null;
    addField: (zone: BuilderZone, fieldId: string) => void;
    removeField: (zone: BuilderZone, fieldId: string) => void;
    reorderFields: (zone: "rows" | "columns" | "reportFilters", fieldIds: string[]) => void;
    reorderValueFields: (fieldIds: string[]) => void;
    updateValueAggregation: (fieldId: string, aggregation: AggregationType) => void;
    setFilter: (filter: PivotFilter | null, fieldId?: string) => void;
    clearAllFilters: () => void;
    setSortBy: (fieldId: string) => void;
    toggleRow: (rowKey: string) => void;
    expandAll: () => void;
    collapseAll: () => void;
    resetConfig: () => void;
    openDrillThrough: (cell: PivotCell) => void;
    closeDrillThrough: () => void;
    addCalculatedPreset: (presetId: string) => void;
    removeCalculatedMeasure: (id: string) => void;
    toggleColumnTotals: () => void;
    updateConfig: (patch: Partial<PivotConfig>) => void;
    hasData: boolean;
    activeFilterCount: number;
};
export {};
//# sourceMappingURL=usePivot.d.ts.map