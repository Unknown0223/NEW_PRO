import type { PivotField, PivotFilter } from "@salec/pivot-engine";
type Props = {
    field: PivotField;
    measureFields: PivotField[];
    filter?: PivotFilter;
    onApply: (filter: PivotFilter | null) => void;
    onClose: () => void;
};
export declare function TopNFilter({ field, measureFields, filter, onApply, onClose }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=TopNFilter.d.ts.map