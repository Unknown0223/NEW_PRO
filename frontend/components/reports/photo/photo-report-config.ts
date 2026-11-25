import type { FlatReportConfig, FlatReportFilterField } from "@/components/reports/flat-report/types";

export const PHOTO_FILTER_FIELDS: FlatReportFilterField[] = [
  { kind: "dateRange" },
  { kind: "select", paramKey: "archive", optionsFrom: "archive", defaultValue: "active" },
  { kind: "select", paramKey: "client_active", optionsFrom: "client_active", defaultValue: "all" },
  {
    kind: "multiSelect",
    paramKey: "photo_categories",
    optionsFrom: "photo_categories",
    placeholder: "Категория фотоотчёта"
  },
  {
    kind: "multiSelect",
    paramKey: "user_roles",
    optionsFrom: "user_roles",
    placeholder: "Роль"
  },
  { kind: "multiSelect", paramKey: "user_ids", optionsFrom: "users", placeholder: "Пользователь" },
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

/** FlatReportFilters config shell (filterGridCols: 6). */
export const PHOTO_FILTER_CONFIG: Pick<
  FlatReportConfig,
  "title" | "apiPath" | "exportPermission" | "exportFilename" | "filterFields" | "filterGridCols"
> = {
  title: "Фотоотчёты",
  apiPath: "photo",
  exportPermission: "reports.fotootchyoty.export",
  exportFilename: "fotootchoty.xlsx",
  filterGridCols: 6,
  filterFields: PHOTO_FILTER_FIELDS
};

export type PhotoReportRow = {
  row_number: number;
  photo_id: number;
  client_id: number;
  client_code: string;
  client_name: string;
  created_at: string;
  client_category: string;
  territory: string;
  user_id: number | null;
  user_name: string;
  user_role: string;
  category: string;
  status_label: string;
  content_purged: boolean;
  thumb_url: string | null;
  agent_photo_count: number;
};

export function fmtPhotoDt(iso: unknown) {
  const d = new Date(String(iso ?? ""));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU");
}
