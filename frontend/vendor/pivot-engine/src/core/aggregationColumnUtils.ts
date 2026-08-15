import type { AggregationType, PivotConfig, PivotRow, PivotCell } from "../types/pivot.types.js";

export function valueFieldIdFromColumnKey(columnKey: string, config: PivotConfig): string | null {
  if (config.columns.length > 0) {
    const parts = columnKey.split("__");
    if (parts.length > 1) return parts.slice(1).join("__");
  }
  return config.values.find((v) => v.fieldId === columnKey)?.fieldId ?? null;
}

export function aggregationForColumn(columnKey: string, config: PivotConfig): AggregationType | null {
  const fieldId = valueFieldIdFromColumnKey(columnKey, config);
  if (!fieldId) return null;
  return config.values.find((v) => v.fieldId === fieldId)?.aggregation ?? null;
}

export function collectValueCells(rows: PivotRow[]): PivotCell[] {
  const cells: PivotCell[] = [];
  function walk(row: PivotRow) {
    for (const cell of row.cells) {
      if (cell.columnKey !== "__row_label__") cells.push(cell);
    }
    row.children?.forEach(walk);
    if (row.subtotal) {
      for (const cell of row.subtotal.cells) {
        if (cell.columnKey !== "__row_label__") cells.push(cell);
      }
    }
  }
  rows.forEach(walk);
  return cells;
}

export function columnTotals(rows: PivotRow[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const cell of collectValueCells(rows)) {
    if (cell.rawValue == null || !Number.isFinite(cell.rawValue)) continue;
    totals.set(cell.columnKey, (totals.get(cell.columnKey) ?? 0) + cell.rawValue);
  }
  return totals;
}

export function measureGrandTotals(rows: PivotRow[], config: PivotConfig): Map<string, number> {
  const totals = new Map<string, number>();
  for (const cell of collectValueCells(rows)) {
    const fieldId = valueFieldIdFromColumnKey(cell.columnKey, config);
    if (!fieldId || cell.rawValue == null || !Number.isFinite(cell.rawValue)) continue;
    totals.set(fieldId, (totals.get(fieldId) ?? 0) + cell.rawValue);
  }
  return totals;
}

export function rowTotals(row: PivotRow, measureFieldId: string, config: PivotConfig): number {
  let sum = 0;
  for (const cell of row.cells) {
    if (cell.columnKey === "__row_label__") continue;
    const fieldId = valueFieldIdFromColumnKey(cell.columnKey, config);
    if (fieldId !== measureFieldId) continue;
    if (cell.rawValue != null && Number.isFinite(cell.rawValue)) sum += cell.rawValue;
  }
  return sum;
}
