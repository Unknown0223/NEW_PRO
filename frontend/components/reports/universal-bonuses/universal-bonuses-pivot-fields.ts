import type { PivotConfig, PivotField } from "@salec/pivot-engine";
import { flattenConfigZones } from "@/lib/pivot-flat-layout";
import { resolveLayoutForm } from "@/lib/pivot-layout-form";
import type { LayoutOptionsSelection } from "@/components/reports/virtual-pivot-layout-options-dialog";

export type { LayoutOptionsSelection };

export const UNIVERSAL_BONUSES_DEFAULT_FLAT_FIELD_IDS = [
  "order_id",
  "order_status",
  "product_name",
  "sku",
  "category_name",
  "client_name",
  "client_category",
  "agent_name",
  "qty",
  "volume_m3",
  "line_total",
  "created_at",
  "shipped_at"
] as const;

export const UNIVERSAL_BONUSES_PIVOT_FIELDS: PivotField[] = [
  { id: "order_id", label: "ID ЗАКАЗА", dataType: "number" },
  { id: "order_status", label: "СТАТУС", dataType: "string" },
  { id: "product_name", label: "ТОВАР", dataType: "string" },
  { id: "sku", label: "АРТИКУЛ", dataType: "string" },
  { id: "category_name", label: "КАТЕГОРИЯ", dataType: "string" },
  { id: "client_name", label: "КЛИЕНТ", dataType: "string" },
  { id: "client_category", label: "КАТ. КЛИЕНТА", dataType: "string" },
  { id: "agent_name", label: "АГЕНТ", dataType: "string" },
  { id: "qty", label: "КОЛ-ВО", dataType: "number" },
  { id: "volume_m3", label: "ОБЪЁМ", dataType: "number" },
  { id: "line_total", label: "СУММА", dataType: "number" },
  { id: "created_at", label: "ДАТА СОЗДАНИЯ", dataType: "date" },
  { id: "shipped_at", label: "ДАТА ОТГРУЗКИ", dataType: "date" }
];

export function buildUniversalBonusesFlatPivotConfig(base?: Partial<PivotConfig>): PivotConfig {
  const available = new Set(UNIVERSAL_BONUSES_PIVOT_FIELDS.map((f) => f.id));
  const rows = UNIVERSAL_BONUSES_DEFAULT_FLAT_FIELD_IDS.filter((id) => available.has(id));
  return flattenConfigZones({
    rows,
    columns: [],
    values: [],
    reportFilters: [],
    filters: [],
    options: {
      showGrandTotal: false,
      showSubtotals: false,
      showColumnTotals: false,
      compactMode: false,
      layoutForm: "flat",
      drillDown: false
    },
    ...base
  });
}

export function selectionFromConfig(config: PivotConfig): LayoutOptionsSelection {
  const layout = resolveLayoutForm(config.options);
  return {
    layoutForm: layout,
    grandTotals:
      !config.options.showGrandTotal && !config.options.showColumnTotals
        ? "none"
        : config.options.showGrandTotal && config.options.showColumnTotals
          ? "both"
          : config.options.showColumnTotals && !config.options.showGrandTotal
            ? "columns"
            : "rows",
    subtotals: !config.options.showSubtotals
      ? "none"
      : config.options.subtotalScope === "rows"
        ? "rows"
        : config.options.subtotalScope === "columns"
          ? "columns"
          : "both"
  };
}

function totalsFromSelection(sel: LayoutOptionsSelection) {
  return {
    showGrandTotal: sel.grandTotals === "both" || sel.grandTotals === "rows",
    showColumnTotals: sel.grandTotals === "both" || sel.grandTotals === "columns",
    showSubtotals: sel.subtotals !== "none",
    subtotalScope: (sel.subtotals === "none" ? "both" : sel.subtotals) as
      | "both"
      | "rows"
      | "columns"
  };
}

export function applyUniversalBonusesLayoutOptions(
  from: PivotConfig | undefined,
  sel: LayoutOptionsSelection
): PivotConfig {
  const totals = totalsFromSelection(sel);
  if (sel.layoutForm === "flat") {
    const flat = buildUniversalBonusesFlatPivotConfig({
      filters: from?.filters ?? [],
      reportFilters: from?.reportFilters ?? [],
      calculatedMeasures: from?.calculatedMeasures
    });
    return {
      ...flat,
      options: {
        ...flat.options,
        ...totals,
        compactMode: false,
        layoutForm: "flat",
        drillDown: false
      }
    };
  }
  const classic = buildUniversalBonusesClassicPivotConfig(from);
  return {
    ...classic,
    options: {
      ...classic.options,
      ...totals,
      layoutForm: sel.layoutForm,
      compactMode: sel.layoutForm === "compact",
      drillDown: classic.options.drillDown ?? true
    }
  };
}

/** Classic needs ≥1 value — default SUM(qty). */
export function buildUniversalBonusesClassicPivotConfig(from?: PivotConfig): PivotConfig {
  const available = new Set(UNIVERSAL_BONUSES_PIVOT_FIELDS.map((f) => f.id));
  const preferRows = ["agent_name", "product_name", "client_name"].filter((id) =>
    available.has(id)
  );
  const fromLayout = from ? resolveLayoutForm(from.options) : null;
  const keepRows = fromLayout === "classic" || fromLayout === "compact";
  const baseRows =
    from && keepRows && from.rows.length
      ? from.rows.filter((id) => available.has(id))
      : preferRows;
  const values =
    from?.values?.length && from.values.some((v) => available.has(v.fieldId))
      ? from.values
      : [{ fieldId: "qty", aggregation: "SUM" as const, label: "Кол-во" }];

  return {
    rows: baseRows.length ? baseRows : preferRows,
    columns: from?.columns?.filter((id) => available.has(id)) ?? [],
    values,
    reportFilters: from?.reportFilters ?? [],
    filters: from?.filters ?? [],
    calculatedMeasures: from?.calculatedMeasures,
    options: {
      ...(from?.options ?? {}),
      layoutForm: "classic",
      compactMode: false,
      drillDown: from?.options?.drillDown ?? true,
      showGrandTotal: true,
      showSubtotals: true,
      showColumnTotals: true
    }
  };
}
