import type {
  PivotCell,
  PivotConfig,
  PivotData,
  PivotField,
  PivotHeader,
  PivotRow,
  PivotTotalRow
} from "../types/pivot.types.js";
import { formatValue, shouldShowCurrencySuffix } from "./formatters.js";
import { applyCalculatedMeasures, calculatedMeasuresToFields } from "./calculatedMeasures.js";
import { FilterEngine } from "../core/FilterEngine.js";
import { getPivotStrings } from "../i18n/index.js";
import { getActiveSliceFilters } from "./sliceFilters.js";

/** Flat jadval ustun tartibi: rows → columns → values (takrorlarsiz).
 * Report filters — faqat filtr, ustun emas (WDR flat).
 */
export function getFlatColumnFieldIds(config: PivotConfig): string[] {
  const ordered = [
    ...config.rows,
    ...config.columns,
    ...config.values.map((v) => v.fieldId)
  ];
  const seen = new Set<string>();
  const ids: string[] = [];
  for (const id of ordered) {
    if (seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function formatCellValue(
  raw: unknown,
  field: PivotField | undefined,
  showCurrency: boolean
): { value: number | string | null; rawValue: number | null; formatted: string; isEmpty: boolean } {
  if (raw == null || raw === "") {
    return { value: null, rawValue: null, formatted: "(blank)", isEmpty: true };
  }
  if (field?.dataType === "number" || field?.dataType === "currency") {
    const n = typeof raw === "number" ? raw : Number(raw);
    if (Number.isFinite(n)) {
      return {
        value: n,
        rawValue: n,
        formatted: formatValue(n, field.format, { showCurrency }),
        isEmpty: false
      };
    }
  }
  if (raw instanceof Date || field?.dataType === "date") {
    const d = raw instanceof Date ? raw : new Date(String(raw));
    if (!Number.isNaN(d.getTime())) {
      return {
        value: d.toISOString(),
        rawValue: null,
        formatted: formatValue(d, field?.format ?? { type: "date" }, { showCurrency }),
        isEmpty: false
      };
    }
  }
  const s = String(raw).trim();
  if (!s) {
    return { value: null, rawValue: null, formatted: "(blank)", isEmpty: true };
  }
  return {
    value: s,
    rawValue: null,
    formatted: formatValue(s, field?.format, { showCurrency }),
    isEmpty: false
  };
}

/**
 * WDR flat form: agregatsiyasiz raw qatorlar, har maydon alohida ustun.
 */
export function buildFlatPivotData(
  rawData: Record<string, unknown>[],
  fields: PivotField[],
  config: PivotConfig,
  startTime = performance.now()
): PivotData {
  const warnings: string[] = [];
  const columnIds = getFlatColumnFieldIds(config);

  if (!columnIds.length) {
    return {
      headers: [],
      rows: [],
      metadata: {
        totalRows: rawData.length,
        processedRows: 0,
        executionTime: performance.now() - startTime,
        warnings: [getPivotStrings().engine.noValueFields]
      }
    };
  }

  const filterEngine = new FilterEngine();
  const filters = getActiveSliceFilters(config);
  let workingData = filterEngine.apply(rawData, filters, fields);
  workingData = applyCalculatedMeasures(workingData, config.calculatedMeasures ?? [], fields);

  if (config.options.maxRows && workingData.length > config.options.maxRows) {
    warnings.push(
      getPivotStrings().reportBuilder.pivotRowsTruncated(
        String(config.options.maxRows),
        String(workingData.length)
      )
    );
    workingData = workingData.slice(0, config.options.maxRows);
  }

  const enrichedFields = [...fields, ...calculatedMeasuresToFields(config.calculatedMeasures ?? [])];
  const fieldMap = new Map(enrichedFields.map((f) => [f.id, f]));
  const showCurrency = shouldShowCurrencySuffix(config, enrichedFields);

  const headers: PivotHeader[][] = [
    columnIds.map((id) => {
      const field = fieldMap.get(id);
      return {
        key: id,
        label: field?.label ?? id,
        depth: 0,
        colspan: 1,
        rowspan: 1,
        isValue: field?.dataType === "number" || field?.dataType === "currency"
      };
    })
  ];

  const rows: PivotRow[] = workingData.map((row, index) => {
    const cells: PivotCell[] = columnIds.map((id) => {
      const field = fieldMap.get(id);
      const { value, rawValue, formatted, isEmpty } = formatCellValue(row[id], field, showCurrency);
      return {
        columnKey: id,
        value,
        rawValue,
        formatted,
        isEmpty
      };
    });
    return { key: `flat-${index}`, depth: 0, cells };
  });

  let grandTotal: PivotTotalRow | undefined;
  if (config.options.showGrandTotal && workingData.length > 0) {
    const cells: PivotCell[] = columnIds.map((id, colIdx) => {
      const field = fieldMap.get(id);
      const isNumeric = field?.dataType === "number" || field?.dataType === "currency";
      if (colIdx === 0) {
        return {
          columnKey: id,
          value: getPivotStrings().engine.grandTotal,
          rawValue: null,
          formatted: getPivotStrings().engine.grandTotal,
          isEmpty: false
        };
      }
      if (!isNumeric) {
        return {
          columnKey: id,
          value: null,
          rawValue: null,
          formatted: "",
          isEmpty: true
        };
      }
      let sum = 0;
      for (const dataRow of workingData) {
        const n = Number(dataRow[id]);
        if (Number.isFinite(n)) sum += n;
      }
      return {
        columnKey: id,
        value: sum,
        rawValue: sum,
        formatted: formatValue(sum, field?.format, { showCurrency }),
        isEmpty: false
      };
    });
    grandTotal = { label: getPivotStrings().engine.grandTotal, cells };
  }

  return {
    headers,
    rows,
    grandTotal,
    metadata: {
      totalRows: rawData.length,
      processedRows: workingData.length,
      executionTime: performance.now() - startTime,
      warnings
    }
  };
}
