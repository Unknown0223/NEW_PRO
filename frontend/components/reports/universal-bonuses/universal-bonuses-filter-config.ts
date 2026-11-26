import type { FlatReportConfig, FlatReportFilterField } from "@/components/reports/flat-report/types";

export const UNIVERSAL_BONUSES_FILTER_FIELDS: FlatReportFilterField[] = [
  { kind: "dateRange" },
  { kind: "select", paramKey: "date_type", optionsFrom: "date_types", defaultValue: "created_at" },
  { kind: "multiSelect", paramKey: "statuses", optionsFrom: "statuses", placeholder: "Статус" },
  { kind: "multiSelect", paramKey: "agent_ids", optionsFrom: "agents", placeholder: "Агент" },
  {
    kind: "multiSelect",
    paramKey: "category_ids",
    optionsFrom: "categories",
    placeholder: "Категория товара"
  },
  {
    kind: "multiSelect",
    paramKey: "client_categories",
    optionsFrom: "client_categories",
    placeholder: "Категория клиента"
  },
  {
    kind: "multiSelect",
    paramKey: "territory_1_list",
    optionsFrom: "territory_1",
    placeholder: "Зона"
  },
  {
    kind: "multiSelect",
    paramKey: "territory_2_list",
    optionsFrom: "territory_2",
    placeholder: "Область"
  },
  {
    kind: "multiSelect",
    paramKey: "territory_3_list",
    optionsFrom: "territory_3",
    placeholder: "Город"
  }
];

/** Shell for FlatReportFilters (grid only) — Virtual Pivot workspace. */
export const UNIVERSAL_BONUSES_FILTER_CONFIG = {
  title: "Универсальный отчет по бонусам",
  apiPath: "universal-bonuses",
  exportPermission: "reports.universalnyy_bonus.export",
  exportFilename: "universalnyy-bonus.xlsx",
  tablePrefsId: "report.universal-bonuses.v1",
  dateTypeAsRadio: true,
  /** 7 multi-select → xl 9 ustun ≈ 1 qator. */
  filterGridCols: 9,
  filterFields: UNIVERSAL_BONUSES_FILTER_FIELDS,
  columns: [],
  totalsKeys: [],
  rowKey: "order_id"
} as FlatReportConfig;
