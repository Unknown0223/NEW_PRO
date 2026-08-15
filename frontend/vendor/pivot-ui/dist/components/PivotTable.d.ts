import type { PivotCell as PivotCellType, PivotConfig, PivotData } from "@salec/pivot-engine";
type Props = {
    data: PivotData;
    config: PivotConfig;
    expandedRows: Set<string>;
    onToggleRow: (key: string) => void;
    onSort?: (fieldId: string) => void;
    onCellDoubleClick?: (cell: PivotCellType) => void;
    className?: string;
};
export declare function PivotTable({ data, config, expandedRows, onToggleRow, onSort, onCellDoubleClick, className }: Props): import("react").JSX.Element;
export {};
//# sourceMappingURL=PivotTable.d.ts.map