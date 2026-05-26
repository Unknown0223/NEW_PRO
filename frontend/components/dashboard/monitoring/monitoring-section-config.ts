export const MONITORING_SECTION_PREFS_TABLE_ID = "dashboard-sales-monitoring/sections";

/** Shablon `may-2026-sales-analysis` — `sectionOptions` */
export type MonitoringSectionId =
  | "byBranches"
  | "byTradeDirections"
  | "akbByPortfolios"
  | "bySku"
  | "bySales"
  | "okbAkb"
  | "factByCategories"
  | "yearComparison";

export const MONITORING_SECTION_SETTINGS_ITEMS: Array<{ id: MonitoringSectionId; label: string }> = [
  { id: "byBranches", label: "По филиалам" },
  { id: "byTradeDirections", label: "По направлениям торговли" },
  { id: "akbByPortfolios", label: "Акб по портфелям и по филиалам" },
  { id: "bySku", label: "Продажи по СКУ" },
  { id: "bySales", label: "По продажам" },
  { id: "okbAkb", label: "ОКБ / АКБ" },
  { id: "factByCategories", label: "Факт продаж по категориям" },
  { id: "yearComparison", label: "Сравнение по годам" }
];

export const MONITORING_SECTION_DEFAULT_ORDER: MonitoringSectionId[] =
  MONITORING_SECTION_SETTINGS_ITEMS.map((s) => s.id);

const LEGACY_HIDDEN: Record<string, MonitoringSectionId[]> = {
  kpi_sales: ["bySales", "okbAkb"],
  charts: ["factByCategories"],
  performance: ["byBranches", "byTradeDirections"],
  portfolio: ["akbByPortfolios"],
  year_comparison: ["yearComparison"],
  sku: ["bySku"],
  client_matrix: []
};

export function expandLegacySectionHidden(id: string): MonitoringSectionId[] {
  if (id in LEGACY_HIDDEN) return LEGACY_HIDDEN[id]!;
  return MONITORING_SECTION_DEFAULT_ORDER.includes(id as MonitoringSectionId)
    ? [id as MonitoringSectionId]
    : [];
}

export function visibleMonitoringSections(hiddenColumnIds: Iterable<string>): Set<MonitoringSectionId> {
  const hidden = new Set<MonitoringSectionId>();
  for (const raw of hiddenColumnIds) {
    for (const id of expandLegacySectionHidden(raw)) hidden.add(id);
  }
  return new Set(MONITORING_SECTION_DEFAULT_ORDER.filter((id) => !hidden.has(id)));
}

export function hiddenMonitoringSectionIds(visible: Set<MonitoringSectionId>): string[] {
  return MONITORING_SECTION_DEFAULT_ORDER.filter((id) => !visible.has(id));
}
