import type { AggregationType, PivotConfig, PivotField, PivotFilter } from "@salec/pivot-engine";
import { type PivotBuilderZone } from "../lib/dnd.js";
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
export declare function PivotBuilder({ fields, config, rawData, onAddField, onRemoveField, onUpdateAggregation, onSetFilter, onAddCalculatedPreset, onRemoveCalculatedMeasure, onReorderFields, onReorderValueFields }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=PivotBuilder.d.ts.map