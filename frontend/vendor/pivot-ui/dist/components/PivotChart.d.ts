import { type PivotChartData, type PivotChartType } from "@salec/pivot-engine";
type Props = {
    data: PivotChartData;
    className?: string;
    chartType?: PivotChartType;
    onChartTypeChange?: (type: PivotChartType) => void;
    warnings?: string[];
};
export declare const PivotChart: import("react").ForwardRefExoticComponent<Props & import("react").RefAttributes<HTMLDivElement>>;
export {};
//# sourceMappingURL=PivotChart.d.ts.map