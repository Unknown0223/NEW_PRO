import type { PivotConfig, PivotField } from "@salec/pivot-engine";
import { getFlatColumnFieldIds } from "@/lib/build-flat-pivot-data";

/** Excel «Плоская» shablonidagi ustunlar (mavjud maydonlar bilan). */
export const FLAT_SALES_DETAIL_FIELD_IDS = [
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
] as const;

/** Flat rejim: barcha tanlangan maydonlar `rows` da (ustun tartibi). */
export function flattenConfigZones(config: PivotConfig): PivotConfig {
  const ids = getFlatColumnFieldIds(config);
  return {
    ...config,
    rows: ids,
    columns: [],
    values: [],
    options: {
      ...config.options,
      layoutForm: "flat",
      compactMode: false,
      showGrandTotal: false,
      showSubtotals: false,
      showColumnTotals: false
    }
  };
}

export function applyFlatSalesDetailTemplate(
  fields: PivotField[],
  base: PivotConfig
): PivotConfig {
  const available = new Set(fields.map((f) => f.id));
  const rows = FLAT_SALES_DETAIL_FIELD_IDS.filter((id) => available.has(id));
  return flattenConfigZones({
    ...base,
    rows,
    columns: [],
    values: [],
    reportFilters: base.reportFilters,
    filters: base.filters
  });
}

/** Klassik shablon: ierarxiya + agregatsiya; layoutForm=classic. */
export const CLASSIC_BRANCH_BRAND_FIELD_IDS = [
  "agent_branch",
  "brand_name",
  "product_sku"
] as const;

export function applyClassicBranchBrandTemplate(
  fields: PivotField[],
  base: PivotConfig
): PivotConfig {
  const available = new Set(fields.map((f) => f.id));
  const rows = CLASSIC_BRANCH_BRAND_FIELD_IDS.filter((id) => available.has(id));
  const valueCandidates = [
    { fieldId: "volume", aggregation: "SUM" as const },
    { fieldId: "amount", aggregation: "SUM" as const }
  ].filter((v) => available.has(v.fieldId));

  return {
    ...base,
    rows,
    columns: [],
    values: valueCandidates.length
      ? valueCandidates
      : base.values.filter((v) => available.has(v.fieldId)),
    reportFilters: base.reportFilters.filter((id) => available.has(id)),
    options: {
      ...base.options,
      layoutForm: "classic",
      compactMode: false
    }
  };
}
