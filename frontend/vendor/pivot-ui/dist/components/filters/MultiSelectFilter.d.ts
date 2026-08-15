import type { PivotFilter } from "@salec/pivot-engine";
type Props = {
    fieldLabel: string;
    members: (string | number)[];
    filter?: PivotFilter;
    onApply: (filter: PivotFilter | null) => void;
    onClose: () => void;
    onTopN?: () => void;
};
export declare function MultiSelectFilter({ fieldLabel, members, filter, onApply, onClose, onTopN }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=MultiSelectFilter.d.ts.map