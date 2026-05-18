/**
 * Legacy `ReportBuilderWorkspace` konfigini WebDataRocks `setReport()` obyektiga aylantiradi.
 * Ma’lumotlar keyinroq `setReport` / `updateData` orqali yuklanadi.
 */

const DATASET_ID = "orders_sales_lines" as const;

export type LegacyMetrics = { amount: boolean; qty: boolean; volume: boolean; akb: boolean };

export type ReportBuilderDateMode = "order_date" | "shipped_date" | "delivered_date" | "created_date";

export type ReportBuilderExtraFiltersPayload = {
  warehouseIds: number[];
  productIds: number[];
  categoryIds: number[];
  productGroupIds: number[];
  brandIds: number[];
  expeditorUserIds: number[];
  supervisorUserIds: number[];
  tradeDirectionIds: number[];
  kpiGroupIds: number[];
  clientIds: number[];
  paymentMethodRefs: string[];
  priceTypeRefs: string[];
  branchValues: string[];
  clientCategoryValues: string[];
  territoryLevel1Values: string[];
  territoryLevel2Values: string[];
  territoryLevel3Values: string[];
};

export function emptyReportBuilderExtraFilters(): ReportBuilderExtraFiltersPayload {
  return {
    warehouseIds: [],
    productIds: [],
    categoryIds: [],
    productGroupIds: [],
    brandIds: [],
    expeditorUserIds: [],
    supervisorUserIds: [],
    tradeDirectionIds: [],
    kpiGroupIds: [],
    clientIds: [],
    paymentMethodRefs: [],
    priceTypeRefs: [],
    branchValues: [],
    clientCategoryValues: [],
    territoryLevel1Values: [],
    territoryLevel2Values: [],
    territoryLevel3Values: []
  };
}

export type DatasetFiltersPayload = {
  datasetId: typeof DATASET_ID;
  dateMode: ReportBuilderDateMode;
  dateFrom: string;
  dateTo: string;
  agentIds: number[];
  statuses: string[];
  orderTypes: string[];
} & ReportBuilderExtraFiltersPayload;

export type LegacyConfigPayload = DatasetFiltersPayload & {
  rowFieldIds: string[];
  colFieldIds: string[];
  metrics: LegacyMetrics;
};

/** WebDataRocks Report (minimal shakl). */
export type WdrReportJson = {
  dataSource?: { dataSourceType?: string; data?: unknown[] };
  slice?: {
    rows?: Array<{ uniqueName?: string }>;
    columns?: Array<{ uniqueName?: string }>;
    measures?: Array<{ uniqueName?: string; aggregation?: string }>;
  };
  /** Saqlashda: `/dataset` uchun filtrlar (legacy to‘liq konfig emas). */
  savdoDatasetFilters?: DatasetFiltersPayload | LegacyConfigPayload;
  [key: string]: unknown;
};

export function isWdrSavedConfig(config: unknown): config is WdrReportJson {
  if (!config || typeof config !== "object") return false;
  const c = config as WdrReportJson;
  return c.dataSource != null && typeof c.dataSource === "object" && c.slice != null && typeof c.slice === "object";
}

function numArr(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return Array.from(new Set(v.map((x) => Number(x)).filter((n) => Number.isFinite(n) && n > 0)));
}

function strArr(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return Array.from(new Set(v.map((x) => String(x).trim()).filter(Boolean)));
}

const DATE_MODES = new Set<ReportBuilderDateMode>(["order_date", "shipped_date", "delivered_date", "created_date"]);

function coerceDateMode(v: unknown): ReportBuilderDateMode {
  return typeof v === "string" && DATE_MODES.has(v as ReportBuilderDateMode) ? (v as ReportBuilderDateMode) : "order_date";
}

/** Saqlangan WDR / legacy ichidagi `savdoDatasetFilters` dan to‘liq dataset filtri. */
export function normalizeSavedDatasetFilters(emb: unknown): DatasetFiltersPayload | null {
  if (!emb || typeof emb !== "object") return null;
  const o = emb as Record<string, unknown>;
  const dateFrom = String(o.dateFrom ?? "").trim().slice(0, 10);
  const dateTo = String(o.dateTo ?? "").trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateFrom) || !/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) return null;
  return {
    datasetId: DATASET_ID,
    dateMode: coerceDateMode(o.dateMode),
    dateFrom,
    dateTo,
    agentIds: numArr(o.agentIds),
    statuses: strArr(o.statuses).map((s) => s.toLowerCase()),
    orderTypes: strArr(o.orderTypes),
    warehouseIds: numArr(o.warehouseIds),
    productIds: numArr(o.productIds),
    categoryIds: numArr(o.categoryIds),
    productGroupIds: numArr(o.productGroupIds),
    brandIds: numArr(o.brandIds),
    expeditorUserIds: numArr(o.expeditorUserIds),
    supervisorUserIds: numArr(o.supervisorUserIds),
    tradeDirectionIds: numArr(o.tradeDirectionIds),
    kpiGroupIds: numArr(o.kpiGroupIds),
    clientIds: numArr(o.clientIds),
    paymentMethodRefs: strArr(o.paymentMethodRefs),
    priceTypeRefs: strArr(o.priceTypeRefs),
    branchValues: strArr(o.branchValues),
    clientCategoryValues: strArr(o.clientCategoryValues),
    territoryLevel1Values: strArr(o.territoryLevel1Values),
    territoryLevel2Values: strArr(o.territoryLevel2Values),
    territoryLevel3Values: strArr(o.territoryLevel3Values)
  };
}

function savdoFiltersFromLegacy(legacy: LegacyConfigPayload): DatasetFiltersPayload {
  const n = normalizeSavedDatasetFilters(legacy);
  if (n) return n;
  const x = emptyReportBuilderExtraFilters();
  return {
    datasetId: DATASET_ID,
    dateMode: legacy.dateMode,
    dateFrom: legacy.dateFrom,
    dateTo: legacy.dateTo,
    agentIds: legacy.agentIds ?? [],
    statuses: legacy.statuses ?? [],
    orderTypes: legacy.orderTypes ?? [],
    warehouseIds: legacy.warehouseIds ?? x.warehouseIds,
    productIds: legacy.productIds ?? x.productIds,
    categoryIds: legacy.categoryIds ?? x.categoryIds,
    productGroupIds: legacy.productGroupIds ?? x.productGroupIds,
    brandIds: legacy.brandIds ?? x.brandIds,
    expeditorUserIds: legacy.expeditorUserIds ?? x.expeditorUserIds,
    supervisorUserIds: legacy.supervisorUserIds ?? x.supervisorUserIds,
    tradeDirectionIds: legacy.tradeDirectionIds ?? x.tradeDirectionIds,
    kpiGroupIds: legacy.kpiGroupIds ?? x.kpiGroupIds,
    clientIds: legacy.clientIds ?? x.clientIds,
    paymentMethodRefs: legacy.paymentMethodRefs ?? x.paymentMethodRefs,
    priceTypeRefs: legacy.priceTypeRefs ?? x.priceTypeRefs,
    branchValues: legacy.branchValues ?? x.branchValues,
    clientCategoryValues: legacy.clientCategoryValues ?? x.clientCategoryValues,
    territoryLevel1Values: legacy.territoryLevel1Values ?? x.territoryLevel1Values,
    territoryLevel2Values: legacy.territoryLevel2Values ?? x.territoryLevel2Values,
    territoryLevel3Values: legacy.territoryLevel3Values ?? x.territoryLevel3Values
  };
}

export function migrateLegacyReportBuilderConfigToWdrReport(legacy: LegacyConfigPayload): WdrReportJson {
  const rows = (legacy.rowFieldIds ?? []).map((id) => ({ uniqueName: id }));
  const columns = (legacy.colFieldIds ?? []).map((id) => ({ uniqueName: id }));
  const measures: Array<{ uniqueName: string; aggregation: string }> = [];
  if (legacy.metrics.amount) measures.push({ uniqueName: "amount", aggregation: "sum" });
  if (legacy.metrics.qty) measures.push({ uniqueName: "qty", aggregation: "sum" });
  if (legacy.metrics.volume) measures.push({ uniqueName: "volume", aggregation: "sum" });
  if (legacy.metrics.akb) measures.push({ uniqueName: "client_id", aggregation: "distinctcount" });
  if (measures.length === 0) measures.push({ uniqueName: "amount", aggregation: "sum" });

  return {
    dataSource: { dataSourceType: "json", data: [] },
    slice: { rows, columns, measures },
    savdoDatasetFilters: savdoFiltersFromLegacy(legacy)
  };
}

/** Pivotdan serverdagi GROUP BY eksportiga mos legacy konfig. */
export function wdrSliceToLegacyExportPayload(
  filters: DatasetFiltersPayload,
  slice: NonNullable<WdrReportJson["slice"]>
): LegacyConfigPayload {
  const rowFieldIds = (slice.rows ?? []).map((r) => String(r.uniqueName ?? "")).filter(Boolean);
  const colFieldIds = (slice.columns ?? []).map((c) => String(c.uniqueName ?? "")).filter(Boolean);
  const metrics: LegacyMetrics = { amount: false, qty: false, volume: false, akb: false };
  for (const m of slice.measures ?? []) {
    const u = String(m.uniqueName ?? "");
    const agg = String(m.aggregation ?? "sum").toLowerCase();
    if (u === "client_id" && agg.includes("distinct")) metrics.akb = true;
    else if (u === "amount") metrics.amount = true;
    else if (u === "qty") metrics.qty = true;
    else if (u === "volume") metrics.volume = true;
  }
  if (!metrics.amount && !metrics.qty && !metrics.volume && !metrics.akb) {
    metrics.amount = true;
  }
  return {
    ...filters,
    rowFieldIds,
    colFieldIds,
    metrics
  };
}
