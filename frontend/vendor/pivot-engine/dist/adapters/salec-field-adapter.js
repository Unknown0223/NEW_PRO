/** Backend `report-builder.field-registry` dagi qo'shimcha metrikalar. */
const EXTRA_METRIC_FIELDS = {
    price: { label: "Narx", dataType: "currency", format: { type: "currency", currency: "UZS", decimals: 0 } },
    bonus_line_total: { label: "Bonus (qator)", dataType: "currency", format: { type: "currency", currency: "UZS", decimals: 0 } },
    order_bonus_sum: { label: "Bonus (buyurtma)", dataType: "currency", format: { type: "currency", currency: "UZS", decimals: 0 } },
    discount_sum: { label: "Chegirma", dataType: "currency", format: { type: "currency", currency: "UZS", decimals: 0 } },
    client_balance: { label: "Balans", dataType: "currency", format: { type: "currency", currency: "UZS", decimals: 0 } },
    order_debt: { label: "Qarz", dataType: "currency", format: { type: "currency", currency: "UZS", decimals: 0 } },
    product_weight_kg: { label: "Og'irlik", dataType: "number", format: { type: "number", decimals: 2 } },
    retail_stock_qty: { label: "Qoldiq (TT)", dataType: "number", format: { type: "number", decimals: 0 } },
    retail_stock_sold_qty: { label: "Sotuv (TT)", dataType: "number", format: { type: "number", decimals: 0 } },
    retail_stock_amount: { label: "Summa (TT)", dataType: "currency", format: { type: "currency", currency: "UZS", decimals: 0 } },
    client_id: { label: "AKB", dataType: "number", format: { type: "number", decimals: 0 } }
};
const METRIC_DATA_TYPES = {
    amount: "currency",
    qty: "number",
    volume: "number",
    akb: "number"
};
const METRIC_FORMATS = {
    amount: { type: "currency", currency: "UZS", decimals: 0 },
    qty: { type: "number", decimals: 0 },
    volume: { type: "number", decimals: 2 },
    akb: { type: "number", decimals: 0 }
};
/** SALEC `akb` metrikasi WDR da `client_id:distinctcount`. */
const METRIC_FIELD_ID_MAP = {
    akb: "client_id"
};
/**
 * SALEC `/report-builder/metadata` javobini PivotField[] ga aylantiradi.
 */
export function salecFieldsToPivotFields(fields, metrics = []) {
    const dimensionFields = fields.map((field) => ({
        id: field.id,
        label: field.label,
        dataType: inferDimensionDataType(field.id)
    }));
    const metricFields = metrics.map((metric) => {
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
export function salecWdrMeasuresToPivotFields() {
    return Object.entries(EXTRA_METRIC_FIELDS).map(([id, meta]) => ({
        id,
        label: meta.label,
        dataType: meta.dataType,
        format: meta.format
    }));
}
export function salecFieldsToDatasetSchema(datasetId, datasetLabel, fields, metrics = []) {
    const pivotFields = salecFieldsToPivotFields(fields, metrics);
    const dimensions = fields.map((f) => ({
        id: f.id,
        label: f.label,
        role: inferDimensionDataType(f.id) === "date" ? "date" : "dimension",
        dataType: inferDimensionDataType(f.id),
        allowRow: f.allowRow,
        allowCol: f.allowCol,
        allowFilter: true
    }));
    const measures = pivotFields
        .filter((pf) => metrics.some((m) => (METRIC_FIELD_ID_MAP[m.id] ?? m.id) === pf.id))
        .map((pf) => ({
        id: pf.id,
        label: pf.label,
        role: "measure",
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
function isDateFieldKey(key) {
    return key.includes("date") || key.endsWith("_at") || key.endsWith("_date");
}
function isNumericFieldKey(key) {
    if (NUMERIC_MEASURE_IDS.has(key))
        return true;
    if (key.endsWith("_id"))
        return true;
    if (key.endsWith("_year") || key.endsWith("_month") || key.endsWith("_day"))
        return true;
    if (key.includes("amount") || key.includes("sum") || key.includes("balance") || key.includes("debt")) {
        return true;
    }
    return false;
}
function inferDimensionDataType(fieldId) {
    if (fieldId.endsWith("_year") || fieldId.endsWith("_month") || fieldId.endsWith("_day"))
        return "number";
    if (isDateFieldKey(fieldId))
        return "date";
    if (fieldId.includes("amount") || fieldId.includes("sum") || fieldId.includes("balance"))
        return "currency";
    if (fieldId.endsWith("_id") && !fieldId.includes("client"))
        return "number";
    return "string";
}
function parseIsoDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}/.test(value))
        return null;
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d;
}
function coerceEmptyToNull(value) {
    if (value === "" || value === "null" || value === "undefined")
        return null;
    return value;
}
/**
 * SALEC dataset qatorlarini pivot engine uchun normalizatsiya qiladi.
 * Sana, null va son maydonlarini parse qiladi.
 */
export function normalizeSalecDatasetRows(rows) {
    return rows.map((row) => {
        const next = { ...row };
        for (const [key, value] of Object.entries(next)) {
            const coerced = coerceEmptyToNull(value);
            if (coerced !== value) {
                next[key] = coerced;
                continue;
            }
            if (coerced == null)
                continue;
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
                if (Number.isFinite(n))
                    next[key] = n;
            }
        }
        return next;
    });
}
