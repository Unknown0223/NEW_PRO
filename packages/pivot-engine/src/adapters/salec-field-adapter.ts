import type { DataType, FieldFormat, PivotField } from "../types/pivot.types.js";
import type { DatasetFieldSchema } from "../types/schema.types.js";

/** SALEC report-builder metadata dan keladigan maydon ta'rifi. */
export type SalecReportBuilderField = {
  id: string;
  label: string;
  allowRow?: boolean;
  allowCol?: boolean;
};

export type SalecReportBuilderMetric = {
  id: string;
  label: string;
};

/** Backend `report-builder.field-registry` dagi qo'shimcha metrikalar. */
const EXTRA_METRIC_FIELDS: Record<string, { label: string; dataType: DataType; format?: FieldFormat }> = {
  price: { label: "Narx", dataType: "currency", format: { type: "currency", currency: "UZS", decimals: 0 } },
  bonus_line_total: { label: "Bonus summa (qator)", dataType: "currency", format: { type: "currency", currency: "UZS", decimals: 0 } },
  order_bonus_sum: { label: "Bonuslar summa (buyurtma)", dataType: "currency", format: { type: "currency", currency: "UZS", decimals: 0 } },
  bonus_qty: { label: "Bonuslar", dataType: "number", format: { type: "number", decimals: 3 } },
  discount_sum: { label: "Chegirma", dataType: "currency", format: { type: "currency", currency: "UZS", decimals: 0 } },
  client_balance: { label: "Balans", dataType: "currency", format: { type: "currency", currency: "UZS", decimals: 0 } },
  order_debt: { label: "Qarz", dataType: "currency", format: { type: "currency", currency: "UZS", decimals: 0 } },
  product_weight_kg: { label: "Og'irlik", dataType: "number", format: { type: "number", decimals: 2 } },
  retail_stock_qty: { label: "Qoldiq (TT)", dataType: "number", format: { type: "number", decimals: 0 } },
  retail_stock_sold_qty: { label: "Sotuv (TT)", dataType: "number", format: { type: "number", decimals: 0 } },
  retail_stock_amount: { label: "Summa (TT)", dataType: "currency", format: { type: "currency", currency: "UZS", decimals: 0 } },
  client_id: { label: "AKB", dataType: "number", format: { type: "number", decimals: 0 } }
};

const METRIC_DATA_TYPES: Record<string, DataType> = {
  amount: "currency",
  qty: "number",
  volume: "number",
  akb: "number"
};

const METRIC_FORMATS: Record<string, FieldFormat> = {
  amount: { type: "currency", currency: "UZS", decimals: 0 },
  qty: { type: "number", decimals: 0 },
  volume: { type: "number", decimals: 2 },
  akb: { type: "number", decimals: 0 }
};

/** SALEC `akb` metrikasi WDR da `client_id:distinctcount`. */
const METRIC_FIELD_ID_MAP: Record<string, string> = {
  akb: "client_id"
};

/**
 * SALEC `/report-builder/metadata` javobini PivotField[] ga aylantiradi.
 */
export function salecFieldsToPivotFields(
  fields: SalecReportBuilderField[],
  metrics: SalecReportBuilderMetric[] = []
): PivotField[] {
  const seen = new Set<string>();
  const dimensionFields: PivotField[] = [];
  for (const field of fields) {
    const id = field.id === "order_bonuses_display" ? "bonus_qty" : field.id;
    if (seen.has(id)) continue;
    seen.add(id);
    const dataType =
      id === "bonus_qty" || id === "block_qty"
        ? ("number" as const)
        : inferDimensionDataType(id);
    dimensionFields.push({
      id,
      label: field.id === "order_bonuses_display" ? field.label || "Бонусы" : field.label,
      dataType
    });
  }

  const metricFields: PivotField[] = metrics.map((metric) => {
    const resolvedId = METRIC_FIELD_ID_MAP[metric.id] ?? metric.id;
    const extra = EXTRA_METRIC_FIELDS[resolvedId];
    return {
      id: resolvedId,
      label: metric.label,
      dataType: METRIC_DATA_TYPES[metric.id] ?? extra?.dataType ?? "number",
      format: METRIC_FORMATS[metric.id] ?? extra?.format
    };
  });

  return [...dimensionFields, ...metricFields];
}

/** Registry dagi barcha WDR metrikalarini PivotField sifatida qaytaradi. */
export function salecWdrMeasuresToPivotFields(): PivotField[] {
  return Object.entries(EXTRA_METRIC_FIELDS).map(([id, meta]) => ({
    id,
    label: meta.label,
    dataType: meta.dataType,
    format: meta.format
  }));
}

export function salecFieldsToDatasetSchema(
  datasetId: string,
  datasetLabel: string,
  fields: SalecReportBuilderField[],
  metrics: SalecReportBuilderMetric[] = []
): { id: string; label: string; fields: DatasetFieldSchema[]; measures: DatasetFieldSchema[] } {
  const pivotFields = salecFieldsToPivotFields(fields, metrics);
  const dimensions: DatasetFieldSchema[] = fields.map((f) => ({
    id: f.id,
    label: f.label,
    role: inferDimensionDataType(f.id) === "date" ? "date" : "dimension",
    dataType: inferDimensionDataType(f.id),
    allowRow: f.allowRow,
    allowCol: f.allowCol,
    allowFilter: true
  }));

  const measures: DatasetFieldSchema[] = pivotFields
    .filter((pf) => metrics.some((m) => (METRIC_FIELD_ID_MAP[m.id] ?? m.id) === pf.id))
    .map((pf) => ({
      id: pf.id,
      label: pf.label,
      role: "measure" as const,
      dataType: pf.dataType,
      allowRow: false,
      allowCol: false,
      allowFilter: false
    }));

  return { id: datasetId, label: datasetLabel, fields: dimensions, measures };
}

/** Backend field-registry dagi barcha sonli metrikalar. */
const NUMERIC_MEASURE_IDS = new Set([
  ...Object.keys(EXTRA_METRIC_FIELDS),
  "amount",
  "qty",
  "volume"
]);

function isDateFieldKey(key: string): boolean {
  return key.includes("date") || key.endsWith("_at") || key.endsWith("_date");
}

function isNumericFieldKey(key: string): boolean {
  if (NUMERIC_MEASURE_IDS.has(key)) return true;
  if (key.endsWith("_id")) return true;
  if (key.endsWith("_year") || key.endsWith("_month") || key.endsWith("_day")) return true;
  if (key.includes("amount") || key.includes("sum") || key.includes("balance") || key.includes("debt")) {
    return true;
  }
  if (key === "bonus_qty" || key === "block_qty" || /(^|_)qty$/i.test(key)) return true;
  return false;
}

function inferDimensionDataType(fieldId: string): DataType {
  if (fieldId.endsWith("_year") || fieldId.endsWith("_month") || fieldId.endsWith("_day")) return "number";
  if (isDateFieldKey(fieldId)) return "date";
  if (fieldId.includes("amount") || fieldId.includes("sum") || fieldId.includes("balance")) return "currency";
  /** Bonus dona / blok miqdorlari — Значения (Σ). */
  if (fieldId === "bonus_qty" || fieldId === "block_qty" || /(^|_)qty$/i.test(fieldId)) return "number";
  if (fieldId.endsWith("_id") && !fieldId.includes("client")) return "number";
  return "string";
}

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}/.test(value)) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function coerceEmptyToNull(value: unknown): unknown {
  if (value === "" || value === "null" || value === "undefined") return null;
  return value;
}

/**
 * SALEC dataset qatorlarini pivot engine uchun normalizatsiya qiladi.
 * Sana, null va son maydonlarini parse qiladi.
 */
export function normalizeSalecDatasetRows(
  rows: Record<string, unknown>[]
): Record<string, unknown>[] {
  return rows.map((row) => {
    const next: Record<string, unknown> = { ...row };
    for (const [key, value] of Object.entries(next)) {
      const coerced = coerceEmptyToNull(value);
      if (coerced !== value) {
        next[key] = coerced;
        continue;
      }
      if (coerced == null) continue;

      if (typeof coerced === "string" && isDateFieldKey(key)) {
        const d = parseIsoDate(coerced);
        if (d) {
          next[key] = d;
          continue;
        }
      }

      if (typeof coerced === "string" && isNumericFieldKey(key)) {
        const trimmed = coerced.trim();
        if (trimmed === "") {
          next[key] = null;
          continue;
        }
        const n = Number(trimmed);
        if (Number.isFinite(n)) next[key] = n;
      }
    }
    return next;
  });
}
