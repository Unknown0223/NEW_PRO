/**
 * SALEC frontend ↔ @salec/pivot-engine yupqa bridge.
 * API chaqiruvlari va Phase A yadro re-eksportlari.
 */

import {
  Aggregator,
  FilterEngine,
  groupBy,
  normalizeSalecDatasetRows,
  salecFieldsToPivotFields,
  wdrReportToPivotConfig,
  wdrSliceToPivotConfig,
  isWdrSavedReportConfig,
  detectSavedReportFormat,
  PivotEngine,
  DEFAULT_PIVOT_CONFIG,
  type PivotField,
  type PivotFilter,
  type PivotConfig,
  type PivotData,
  type SalecReportBuilderField,
  type SalecReportBuilderMetric,
  type WdrSliceJson,
  type WdrSavedReport
} from "@salec/pivot-engine";
import { api } from "@/lib/api";
import { isPivotEngineEnabled } from "@/lib/feature-flags";
import type { DatasetFiltersPayload } from "@/lib/report-builder-wdr-migrate";
import { extractSavedDatasetFilters } from "@/lib/report-builder-wdr-migrate";

export {
  Aggregator,
  FilterEngine,
  groupBy,
  salecFieldsToPivotFields,
  normalizeSalecDatasetRows,
  wdrSliceToPivotConfig,
  wdrReportToPivotConfig,
  isWdrSavedReportConfig,
  detectSavedReportFormat,
  PivotEngine,
  DEFAULT_PIVOT_CONFIG,
  type PivotField,
  type PivotFilter,
  type PivotConfig,
  type PivotData,
  type WdrSliceJson,
  type WdrSavedReport
};

export type ReportBuilderMetadata = {
  datasets: Array<{ id: string; label: string }>;
  dateModes: Array<{ id: string; label: string }>;
  fields: SalecReportBuilderField[];
  metrics: SalecReportBuilderMetric[];
};

export type ReportBuilderDatasetRequest = DatasetFiltersPayload & {
  rowFieldIds?: string[];
  colFieldIds?: string[];
  /** Sahifa: boshlang‘ich 1000, scroll bilan keyingisi 500. */
  pageLimit?: number;
  pageOffset?: number;
};

export function isVirtualPivotActive(): boolean {
  return isPivotEngineEnabled();
}

export async function fetchReportBuilderMetadata(
  tenantSlug: string
): Promise<ReportBuilderMetadata> {
  const { data } = await api.get<{ data: ReportBuilderMetadata }>(
    `/api/${tenantSlug}/reports/report-builder/metadata`
  );
  return data.data;
}

/** Ekran: birinchi sahifa 1000, scroll bilan keyingisi 500. */
export const DATASET_DISPLAY_PAGE_SIZE = 1000;
export const DATASET_SCROLL_PAGE_SIZE = 500;

export type ReportBuilderDatasetResult = {
  rows: Record<string, unknown>[];
  truncated: boolean;
  totalRowCount: number;
  cap: number;
  hasMore: boolean;
  pageOffset: number;
  pageLimit: number;
};

export async function fetchReportBuilderDataset(
  tenantSlug: string,
  payload: ReportBuilderDatasetRequest
): Promise<ReportBuilderDatasetResult> {
  const { data } = await api.post<{
    data: {
      rows: Record<string, unknown>[];
      truncated?: boolean;
      totalRowCount?: number;
      cap?: number;
      hasMore?: boolean;
      pageOffset?: number;
      pageLimit?: number;
    };
  }>(`/api/${tenantSlug}/reports/report-builder/dataset`, payload);
  const body = data.data;
  const rows = normalizeSalecDatasetRows(body.rows ?? []);
  const pageLimit = body.pageLimit ?? payload.pageLimit ?? rows.length;
  const pageOffset = body.pageOffset ?? payload.pageOffset ?? 0;
  return {
    rows,
    truncated: Boolean(body.truncated),
    totalRowCount: body.totalRowCount ?? rows.length,
    cap: body.cap ?? rows.length,
    hasMore: Boolean(body.hasMore),
    pageOffset,
    pageLimit
  };
}

/**
 * Excel/to‘liq hisob uchun barcha sahifalarni 0-dan yuklaydi (cap ichida).
 * Sliding window ekranida `existing` ishonchsiz — shuning uchun doim boshidan.
 */
export async function fetchAllReportBuilderDatasetPages(
  tenantSlug: string,
  base: ReportBuilderDatasetRequest,
  _existing: Record<string, unknown>[] = [],
  meta?: { totalRowCount: number; cap: number; hasMore: boolean }
): Promise<ReportBuilderDatasetResult> {
  let rows: Record<string, unknown>[] = [];
  let offset = 0;
  let hasMore = true;
  let totalRowCount = meta?.totalRowCount ?? 0;
  let cap = meta?.cap ?? 50_000;
  let truncated = false;

  const first = await fetchReportBuilderDataset(tenantSlug, {
    ...base,
    pageLimit: DATASET_DISPLAY_PAGE_SIZE,
    pageOffset: 0
  });
  rows = first.rows;
  offset = rows.length;
  hasMore = first.hasMore;
  totalRowCount = first.totalRowCount;
  cap = first.cap;
  truncated = first.truncated;

  while (hasMore && rows.length < cap) {
    const page = await fetchReportBuilderDataset(tenantSlug, {
      ...base,
      pageLimit: DATASET_SCROLL_PAGE_SIZE,
      pageOffset: offset
    });
    if (!page.rows.length) {
      hasMore = false;
      break;
    }
    rows = rows.concat(page.rows);
    offset = rows.length;
    hasMore = page.hasMore;
    totalRowCount = page.totalRowCount;
    cap = page.cap;
    truncated = page.truncated;
  }

  return {
    rows,
    truncated,
    totalRowCount,
    cap,
    hasMore: false,
    pageOffset: 0,
    pageLimit: rows.length
  };
}

export function metadataToPivotFields(metadata: ReportBuilderMetadata): PivotField[] {
  /** Legacy id → bonus miqdori (Σ / Значения). */
  const fields = metadata.fields.map((f) =>
    f.id === "order_bonuses_display" ? { ...f, id: "bonus_qty", label: f.label || "Бонусы" } : f
  );
  const seen = new Set<string>();
  const deduped = fields.filter((f) => {
    if (seen.has(f.id)) return false;
    seen.add(f.id);
    return true;
  });
  return salecFieldsToPivotFields(deduped, metadata.metrics);
}

/** Saqlangan hisobot konfigini Virtual Pivot `PivotConfig` ga aylantiradi. */
export function savedReportConfigToPivotConfig(config: unknown): PivotConfig | null {
  if (isWdrSavedReportConfig(config)) {
    return wdrReportToPivotConfig(config);
  }
  if (config && typeof config === "object") {
    const c = config as Record<string, unknown>;
    if (c.salecPivotConfig && typeof c.salecPivotConfig === "object" && "values" in c.salecPivotConfig) {
      return c.salecPivotConfig as PivotConfig;
    }
    if ("values" in c) {
      return config as PivotConfig;
    }
  }
  return null;
}

export type SavePivotConfigMeta = DatasetFiltersPayload;

/** Virtual Pivot konfiguratsiyasini saqlangan hisobot sifatida yozadi (WDR wrapper). */
export async function savePivotConfigReport(
  tenantSlug: string,
  name: string,
  pivotConfig: PivotConfig,
  meta: SavePivotConfigMeta
) {
  const { data } = await api.post<{ data: { id: number; name: string } }>(
    `/api/${tenantSlug}/reports/report-builder/saved`,
    {
      name,
      config: {
        dataSource: { type: "salec-pivot-engine" },
        slice: {},
        salecPivotConfig: pivotConfig,
        savdoDatasetFilters: meta,
        datasetId: meta.datasetId ?? "orders_sales_lines",
        dateMode: meta.dateMode ?? "order_date",
        dateFrom: meta.dateFrom,
        dateTo: meta.dateTo
      }
    }
  );
  return data.data;
}

export { extractSavedDatasetFilters };

export async function fetchReportBuilderSavedReports(tenantSlug: string) {
  const { data } = await api.get<{
    data: Array<{ id: number; name: string; dataset_id: string; config: unknown }>;
  }>(`/api/${tenantSlug}/reports/report-builder/saved`);
  return data.data;
}

/** Phase A demo: filter + group + aggregate */
export function demoPivotPhaseA(
  rows: Record<string, unknown>[],
  fields: PivotField[],
  filters: PivotFilter[],
  groupFields: string[],
  valueFieldId: string
) {
  const filterEngine = new FilterEngine();
  const aggregator = new Aggregator();

  const filtered = filterEngine.apply(rows, filters, fields);
  const groups = groupBy(filtered, groupFields);

  const results: Array<{ key: string; sum: number | null; count: number }> = [];
  for (const [key, groupRows] of groups) {
    const values = groupRows
      .map((r) => r[valueFieldId])
      .filter((v): v is number => typeof v === "number");
    results.push({
      key,
      sum: aggregator.aggregate(values, "SUM"),
      count: groupRows.length
    });
  }

  return results;
}
