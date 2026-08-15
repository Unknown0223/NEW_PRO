import type { PivotConfig, PivotField } from "../types/pivot.types.js";
import { DEFAULT_PIVOT_CONFIG } from "../core/PivotEngine.js";
import { getPivotStrings } from "../i18n/index.js";

const TEMPLATE_CONFIGS: Record<string, Partial<PivotConfig>> = {
  agent_kpi: {
    rows: ["supervisor_code", "agent_name"],
    columns: [],
    reportFilters: ["order_status"],
    values: [
      { fieldId: "amount", aggregation: "SUM" },
      { fieldId: "client_id", aggregation: "COUNT_DISTINCT" }
    ]
  },
  retrobonus_volume: {
    rows: ["agent_name"],
    columns: [],
    values: [{ fieldId: "volume", aggregation: "SUM" }]
  }
};

export type PivotSliceTemplate = {
  id: string;
  label: string;
  description: string;
  config: Partial<PivotConfig>;
};

export function getPivotSliceTemplates(): PivotSliceTemplate[] {
  return getPivotStrings().sliceTemplates.map((meta) => ({
    ...meta,
    config: TEMPLATE_CONFIGS[meta.id] ?? {}
  }));
}

function filterKnownFieldIds(ids: string[] | undefined, fieldIds: Set<string>): string[] {
  return (ids ?? []).filter((id) => fieldIds.has(id));
}

/** Slice shablonini mavjud maydonlar bilan qo'llaydi. */
export function applyPivotSliceTemplate(
  templateId: string,
  fields: PivotField[],
  base: PivotConfig = DEFAULT_PIVOT_CONFIG
): PivotConfig | null {
  const template = getPivotSliceTemplates().find((t) => t.id === templateId);
  if (!template) return null;

  const fieldIds = new Set(fields.map((f) => f.id));
  const partial = template.config;

  const values = (partial.values ?? []).filter((v) => fieldIds.has(v.fieldId));
  if (!values.length) return null;

  return {
    ...base,
    rows: filterKnownFieldIds(partial.rows, fieldIds),
    columns: filterKnownFieldIds(partial.columns, fieldIds),
    reportFilters: filterKnownFieldIds(partial.reportFilters, fieldIds),
    values,
    filters: [],
    calculatedMeasures: partial.calculatedMeasures
  };
}
