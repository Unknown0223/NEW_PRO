import type { PivotCellDrillContext, PivotField } from "@salec/pivot-engine";
type Props = {
    open: boolean;
    records: Record<string, unknown>[];
    fields: PivotField[];
    cellContext?: PivotCellDrillContext;
    onClose: () => void;
    className?: string;
};
export declare function PivotDrillThrough({ open, records, fields, cellContext, onClose, className }: Props): import("react").JSX.Element | null;
export {};
//# sourceMappingURL=PivotDrillThrough.d.ts.map