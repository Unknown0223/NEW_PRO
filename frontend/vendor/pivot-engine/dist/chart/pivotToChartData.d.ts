import type { PivotData } from "../types/pivot.types.js";
export declare const CHART_DEFAULT_MAX_CATEGORIES = 24;
export declare const CHART_LARGE_DATASET_THRESHOLD = 50000;
export type ChartSeries = {
    id: string;
    label: string;
    data: Array<number | null>;
};
export type PivotChartMeta = {
    totalCategories: number;
    shownCategories: number;
    truncated: boolean;
    maxCategories: number;
};
export type PivotChartData = {
    categories: string[];
    series: ChartSeries[];
    meta: PivotChartMeta;
};
export type PivotChartType = "bar" | "line" | "pie";
/**
 * PivotData → Recharts / boshqa chart kutubxonalari uchun qatorlar × ustunlar matritsasi.
 */
export declare function pivotToChartData(data: PivotData, options?: {
    maxCategories?: number;
}): PivotChartData;
export declare function pivotChartDataToRechartsRows(chartData: PivotChartData): Array<Record<string, string | number | null>>;
export declare function hasChartableData(chartData: PivotChartData): boolean;
export declare function getChartWarnings(pivotData: PivotData, chartData: PivotChartData, sourceRowCount?: number): string[];
//# sourceMappingURL=pivotToChartData.d.ts.map