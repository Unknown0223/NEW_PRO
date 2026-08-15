import type { PivotField, PivotFilter } from "@salec/pivot-engine";
type Props = {
    field: PivotField;
    members: (string | number)[];
    allFields: PivotField[];
    filter?: PivotFilter;
    onApply: (filter: PivotFilter | null) => void;
    onClose: () => void;
};
export declare function FilterEditor({ field, members, allFields, filter, onApply, onClose }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=FilterEditor.d.ts.map