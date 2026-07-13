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

export async function fetchReportBuilderDataset(
  tenantSlug: string,
  payload: ReportBuilderDatasetRequest
): Promise<Record<string, unknown>[]> {
  const { data } = await api.post<{ data: { rows: Record<string, unknown>[] } }>(
    `/api/${tenantSlug}/reports/report-builder/dataset`,
    payload
  );
  return normalizeSalecDatasetRows(data.data.rows ?? []);
}

export function metadataToPivotFields(metadata: ReportBuilderMetadata): PivotField[] {
  return salecFieldsToPivotFields(metadata.fields, metadata.metrics);
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
