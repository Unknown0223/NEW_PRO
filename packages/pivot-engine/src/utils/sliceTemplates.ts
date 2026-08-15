import type { PivotConfig, PivotField } from "../types/pivot.types.js";
import { DEFAULT_PIVOT_CONFIG } from "../core/defaults.js";
import { getPivotStrings } from "../i18n/index.js";
import { hydratePivotValueLabels } from "./valueLabels.js";

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
  },
  flat_sales_detail: {
    rows: [
      "agent_branch",
      "brand_name",
      "product_group_name",
      "agent_name",
      "client_address",
      "product_article",
      "order_number",
      "client_code",
      "product_sku",
      "volume",
      "block_qty",
      "delivered_date",
      "order_date",
      "shipped_date"
    ],
    columns: [],
    values: [],
    reportFilters: [],
    options: {
      ...DEFAULT_PIVOT_CONFIG.options,
      layoutForm: "flat",
      compactMode: false,
      showGrandTotal: false,
      showSubtotals: false,
      showColumnTotals: false
    }
  },
  classic_branch_brand: {
    rows: ["agent_branch", "brand_name", "product_sku"],
    columns: [],
    reportFilters: ["order_status"],
    values: [
      { fieldId: "volume", aggregation: "SUM" },
      { fieldId: "amount", aggregation: "SUM" }
    ],
    options: {
      ...DEFAULT_PIVOT_CONFIG.options,
      layoutForm: "classic",
      compactMode: false
    }
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

  const values = hydratePivotValueLabels(
    (partial.values ?? []).filter((v) => fieldIds.has(v.fieldId)),
    fields
  );
  const rows = filterKnownFieldIds(partial.rows, fieldIds);
  const columns = filterKnownFieldIds(partial.columns, fieldIds);
  const reportFilters = filterKnownFieldIds(partial.reportFilters, fieldIds);
  const isFlat = partial.options?.layoutForm === "flat" || base.options.layoutForm === "flat";

  // Flat shablon: values shart emas — faqat ustunlar.
  if (!values.length && !isFlat && !rows.length) return null;

  return {
    ...base,
    rows,
    columns,
    reportFilters,
    values: isFlat ? [] : values,
    filters: [],
    calculatedMeasures: partial.calculatedMeasures,
    options: {
      ...base.options,
      ...(partial.options ?? {}),
      ...(isFlat
        ? {
            layoutForm: "flat" as const,
            compactMode: false,
            showGrandTotal: false,
            showSubtotals: false,
            showColumnTotals: false
          }
        : {})
    }
  };
}
