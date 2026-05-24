export const MONITORING_SECTION_PREFS_TABLE_ID = "dashboard-sales-monitoring/sections";

export type MonitoringSectionId =
  | "kpi_sales"
  | "charts"
  | "performance"
  | "portfolio"
  | "year_comparison"
  | "sku"
  | "client_matrix";

/** Ko‘rinish sozlamalari — shablon «Настройки разделов» ro‘yxati. */
export const MONITORING_SECTION_SETTINGS_ITEMS: Array<{ id: MonitoringSectionId; label: string }> = [
  { id: "performance", label: "По филиалам" },
  { id: "sku", label: "Продажи по СКУ" },
  { id: "client_matrix", label: "Клиент × день" },
  { id: "portfolio", label: "АКБ по портфелям и по филиалам" },
  { id: "kpi_sales", label: "По продажам" },
  { id: "kpi_sales", label: "ОКБ / АКБ" },
  { id: "charts", label: "Факт продаж по категориям" },
  { id: "year_comparison", label: "Сравнение по годам" },
  { id: "performance", label: "Продажи по супервайзерам" },
  { id: "performance", label: "По направлениям торговли" }
];

export const MONITORING_SECTION_UNIQUE: Array<{ id: MonitoringSectionId; label: string }> = [
  { id: "kpi_sales", label: "KPI: план, факт, ОКБ, АКБ" },
  { id: "charts", label: "Графики" },
  { id: "performance", label: "Таблицы эффективности" },
  { id: "portfolio", label: "Портфель по филиалам" },
  { id: "year_comparison", label: "Сравнение по годам" },
  { id: "sku", label: "Продажи по СКУ" },
  { id: "client_matrix", label: "Клиент × день" }
];

export const MONITORING_SECTION_DEFAULT_ORDER = MONITORING_SECTION_UNIQUE.map((s) => s.id);
