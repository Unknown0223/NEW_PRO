import type { PivotCell, PivotConfig, PivotData, PivotRow, PivotTotalRow, PivotValue } from "../types/pivot.types.js";
import { formatValue } from "../utils/formatters.js";
import {
  aggregationForColumn,
  columnTotals,
  measureGrandTotals,
  rowTotals,
  valueFieldIdFromColumnKey
} from "./aggregationColumnUtils.js";

function toIndexCell(
  cell: PivotCell,
  numerator: number | null,
  rowTotal: number | null,
  colTotal: number | null,
  measureTotal: number | null,
  valueDef: PivotValue
): PivotCell {
  if (
    numerator == null ||
    rowTotal == null ||
    colTotal == null ||
    measureTotal == null ||
    rowTotal === 0 ||
    colTotal === 0
  ) {
    return { ...cell, value: null, rawValue: null, formatted: "—", isEmpty: true };
  }
  const indexValue = (numerator * measureTotal) / (rowTotal * colTotal);
  return {
    ...cell,
    value: indexValue,
    rawValue: indexValue,
    formatted: formatValue(indexValue, valueDef.format ?? { type: "number", decimals: 2 }),
    isEmpty: false
  };
}

function processRowCells(
  row: PivotRow,
  config: PivotConfig,
  colTotals: Map<string, number>,
  measureTotals: Map<string, number>,
  valueDefMap: Map<string, PivotValue>
): void {
  row.cells = row.cells.map((cell) => {
    if (cell.columnKey === "__row_label__") return cell;
    if (aggregationForColumn(cell.columnKey, config) !== "INDEX") return cell;

    const fieldId = valueFieldIdFromColumnKey(cell.columnKey, config);
    const valueDef = fieldId ? valueDefMap.get(fieldId) : undefined;
    if (!valueDef || !fieldId) return cell;

    return toIndexCell(
      cell,
      cell.rawValue,
      rowTotals(row, fieldId, config),
      colTotals.get(cell.columnKey) ?? null,
      measureTotals.get(fieldId) ?? null,
      valueDef
    );
  });

  row.children?.forEach((child) => processRowCells(child, config, colTotals, measureTotals, valueDefMap));
  if (row.subtotal) {
    row.subtotal = processTotalRow(row.subtotal, config, colTotals, measureTotals, valueDefMap, row);
  }
}

function processTotalRow(
  total: PivotTotalRow,
  config: PivotConfig,
  colTotals: Map<string, number>,
  measureTotals: Map<string, number>,
  valueDefMap: Map<string, PivotValue>,
  parentRow?: PivotRow
): PivotTotalRow {
  return {
    ...total,
    cells: total.cells.map((cell) => {
      if (cell.columnKey === "__row_label__") return cell;
      if (aggregationForColumn(cell.columnKey, config) !== "INDEX") return cell;

      const fieldId = valueFieldIdFromColumnKey(cell.columnKey, config);
      const valueDef = fieldId ? valueDefMap.get(fieldId) : undefined;
      if (!valueDef || !fieldId) return cell;

      const rowTotal = parentRow ? rowTotals(parentRow, fieldId, config) : colTotals.get(cell.columnKey) ?? null;
      return toIndexCell(
        cell,
        cell.rawValue,
        rowTotal,
        colTotals.get(cell.columnKey) ?? null,
        measureTotals.get(fieldId) ?? null,
        valueDef
      );
    })
  };
}

/** INDEX — (value × grand total) / (row total × column total). SUM asosida. */
export function applyIndexAggregations(data: PivotData, config: PivotConfig): PivotData {
  const hasIndex = config.values.some((v) => v.aggregation === "INDEX");
  if (!hasIndex) return data;

  const valueDefMap = new Map(config.values.map((v) => [v.fieldId, v]));
  const colTotals = columnTotals(data.rows);
  const measureTotals = measureGrandTotals(data.rows, config);

  const rows = data.rows.map((row) => {
    const copy = { ...row, cells: [...row.cells] };
    processRowCells(copy, config, colTotals, measureTotals, valueDefMap);
    return copy;
  });

  let columnTotalsRow = data.columnTotals;
  if (columnTotalsRow) {
    columnTotalsRow = processTotalRow(columnTotalsRow, config, colTotals, measureTotals, valueDefMap);
  }

  let grandTotal = data.grandTotal;
  if (grandTotal) {
    grandTotal = processTotalRow(grandTotal, config, colTotals, measureTotals, valueDefMap);
  }

  return { ...data, rows, columnTotals: columnTotalsRow, grandTotal };
}
