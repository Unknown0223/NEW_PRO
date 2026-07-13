import type { PivotConfig, PivotField } from "../types/pivot.types.js";
import { FilterEngine } from "../core/FilterEngine.js";
import { ROOT_COL_KEY } from "../core/CubeBuilder.js";
import { ALL_GROUP_KEY, GROUP_KEY_SEPARATOR, splitGroupKey } from "./groupBy.js";

export interface DrillThroughCellContext {
  /** Cube qator kaliti yoki `__all__` */
  rowGroupKey: string;
  /** Ustun kaliti (`region | Yan__amount` yoki `amount`) */
  columnKey: string;
  /** Metrika maydoni */
  valueFieldId: string;
}

const filterEngine = new FilterEngine();

/** Pivot kataki uchun manba qatorlarni qaytaradi. */
export function getDrillThroughRecords(
  rawData: Record<string, unknown>[],
  fields: PivotField[],
  config: PivotConfig,
  cellContext: DrillThroughCellContext
): Record<string, unknown>[] {
  const reportScopedFilters = config.filters.filter(
    (f) =>
      config.reportFilters.includes(f.fieldId) ||
      config.rows.includes(f.fieldId) ||
      config.columns.includes(f.fieldId)
  );

  let data = filterEngine.apply(rawData, reportScopedFilters, fields);

  if (config.options.maxRows) {
    data = data.slice(0, config.options.maxRows);
  }

  data = filterByRowGroupKey(data, config, cellContext.rowGroupKey);
  data = filterByColumnKey(data, config, cellContext.columnKey, cellContext.valueFieldId);

  return data;
}

function filterByRowGroupKey(
  data: Record<string, unknown>[],
  config: PivotConfig,
  rowGroupKey: string
): Record<string, unknown>[] {
  if (!config.rows.length || rowGroupKey === ALL_GROUP_KEY || rowGroupKey === "__all__") {
    return data;
  }

  const parts = splitGroupKey(rowGroupKey);
  const depth = Math.min(parts.length, config.rows.length);

  return data.filter((row) =>
    config.rows.slice(0, depth).every((fieldId, i) => String(row[fieldId] ?? "N/A") === parts[i])
  );
}

function filterByColumnKey(
  data: Record<string, unknown>[],
  config: PivotConfig,
  columnKey: string,
  valueFieldId: string
): Record<string, unknown>[] {
  if (!config.columns.length) return data;

  const colCubeKey = columnKey.includes("__")
    ? columnKey.split("__")[0]!
    : columnKey === valueFieldId
      ? ROOT_COL_KEY
      : columnKey;

  if (colCubeKey === ROOT_COL_KEY) return data;

  const colParts = splitGroupKey(colCubeKey);
  return data.filter((row) =>
    config.columns.every((fieldId, i) => String(row[fieldId] ?? "N/A") === colParts[i])
  );
}

/** Pivot qator kalitidan cube rowGroupKey ni aniqlaydi. */
export function resolveRowGroupKey(rowKey: string, depth: number, config: PivotConfig): string {
  if (!config.rows.length) return ALL_GROUP_KEY;

  const segments = rowKey.split(" > ").map((s) => s.trim());
  const pathParts: string[] = [];

  for (let d = 0; d <= depth && d < segments.length; d++) {
    const seg = segments[d]!;
    const parts = seg.includes(GROUP_KEY_SEPARATOR) ? splitGroupKey(seg) : [seg];
    pathParts.push(parts[parts.length - 1] ?? seg);
  }

  if (pathParts.length === 0) return ALL_GROUP_KEY;
  return config.rows
    .slice(0, pathParts.length)
    .map((fieldId, i) => pathParts[i] ?? "N/A")
    .join(GROUP_KEY_SEPARATOR);
}
