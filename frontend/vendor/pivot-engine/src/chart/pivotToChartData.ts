import type { PivotData, PivotRow } from "../types/pivot.types.js";
import { getPivotStrings } from "../i18n/index.js";

export const CHART_DEFAULT_MAX_CATEGORIES = 24;
export const CHART_LARGE_DATASET_THRESHOLD = 50_000;

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

export type PivotChartType = "bar" | "line";

function rowLabel(row: PivotRow): string {
  const labelCell = row.cells.find((c) => c.columnKey === "__row_label__");
  if (labelCell?.formatted) return labelCell.formatted;
  if (labelCell?.value != null) return String(labelCell.value);
  return row.key;
}

function flattenTopRows(rows: PivotRow[], maxCategories = 24): PivotRow[] {
  const result: PivotRow[] = [];
  for (const row of rows) {
    if (result.length >= maxCategories) break;
    result.push(row);
  }
  return result;
}

function valueColumns(data: PivotData): string[] {
  const lastLevel = data.headers[data.headers.length - 1];
  if (!lastLevel?.length) {
    const first = data.rows[0];
    return (
      first?.cells
        .filter((c) => c.columnKey !== "__row_label__")
        .map((c) => c.columnKey) ?? []
    );
  }
  return lastLevel.filter((h) => h.isValue).map((h) => h.key);
}

function columnLabel(data: PivotData, columnKey: string): string {
  for (const level of data.headers) {
    const header = level.find((h) => h.key === columnKey);
    if (header?.label) return header.label;
  }
  return columnKey;
}

function cellValue(row: PivotRow, columnKey: string): number | null {
  const cell = row.cells.find((c) => c.columnKey === columnKey);
  if (!cell || cell.rawValue == null || !Number.isFinite(cell.rawValue)) return null;
  return cell.rawValue;
}

/**
 * PivotData → Recharts / boshqa chart kutubxonalari uchun qatorlar × ustunlar matritsasi.
 */
export function pivotToChartData(
  data: PivotData,
  options: { maxCategories?: number } = {}
): PivotChartData {
  const maxCategories = options.maxCategories ?? CHART_DEFAULT_MAX_CATEGORIES;
  const totalCategories = data.rows.length;
  const visibleRows = flattenTopRows(data.rows, maxCategories);
  const categories = visibleRows.map(rowLabel);
  const columns = valueColumns(data);

  const series: ChartSeries[] = columns.map((colKey) => ({
    id: colKey,
    label: columnLabel(data, colKey),
    data: visibleRows.map((row) => cellValue(row, colKey))
  }));

  return {
    categories,
    series,
    meta: {
      totalCategories,
      shownCategories: categories.length,
      truncated: totalCategories > maxCategories,
      maxCategories
    }
  };
}

export function pivotChartDataToRechartsRows(
  chartData: PivotChartData
): Array<Record<string, string | number | null>> {
  return chartData.categories.map((category, i) => {
    const point: Record<string, string | number | null> = { category };
    for (const series of chartData.series) {
      point[series.id] = series.data[i] ?? null;
    }
    return point;
  });
}

export function hasChartableData(chartData: PivotChartData): boolean {
  if (chartData.categories.length === 0 || chartData.series.length === 0) return false;
  return chartData.series.some((s) => s.data.some((v) => v != null && v !== 0));
}

export function getChartWarnings(
  pivotData: PivotData,
  chartData: PivotChartData,
  sourceRowCount?: number
): string[] {
  const t = getPivotStrings().chart;
  const warnings: string[] = [];
  const rows = sourceRowCount ?? pivotData.metadata.processedRows ?? pivotData.metadata.totalRows;

  if (chartData.meta.truncated) {
    warnings.push(
      t.truncatedCategories(chartData.meta.shownCategories, chartData.meta.totalCategories)
    );
  }

  if (rows >= CHART_LARGE_DATASET_THRESHOLD) {
    warnings.push(t.largeDatasetWarning(rows));
  }

  return warnings;
}
