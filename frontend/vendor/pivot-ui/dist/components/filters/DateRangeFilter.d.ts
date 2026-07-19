import type { PivotFilter } from "@salec/pivot-engine";
type Props = {
    fieldLabel: string;
    fieldId: string;
    filter?: PivotFilter;
    onApply: (filter: PivotFilter | null) => void;
    onClose: () => void;
};
export declare function DateRangeFilter({ fieldLabel, fieldId, filter, onApply, onClose }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=DateRangeFilter.d.ts.map