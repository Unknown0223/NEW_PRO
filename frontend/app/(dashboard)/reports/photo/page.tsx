"use client";

/**
 * FlatReport wave-3 adapter (ADR-010 / ADR-012).
 * Parity: filtrlar ha · chrome ha · oylik/dialog — · export+RBAC ha
 */
import { FlatReportPage } from "@/components/reports/flat-report/flat-report-page";
import type { FlatReportConfig } from "@/components/reports/flat-report/types";

function fmtDt(iso: unknown) {
  const d = new Date(String(iso ?? ""));
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("ru-RU");
}

const config: FlatReportConfig = {
  title: "Фотоотчёты",
  apiPath: "photo",
  exportPermission: "reports.fotootchyoty.export",
  exportFilename: "fotootchoty.xlsx",
  filterFields: [
    { kind: "dateRange" },
    { kind: "select", paramKey: "archive", optionsFrom: "archive", defaultValue: "active" },
    { kind: "select", paramKey: "client_active", optionsFrom: "client_active", defaultValue: "all" },
    { kind: "search", placeholder: "Клиент / код / пользователь" },
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
  ],
  columns: [
    { key: "row_number", header: "#", cellClassName: "text-muted-foreground" },
    { key: "client_name", header: "Клиент", cellClassName: "font-medium" },
    { key: "created_at", header: "Дата" },
    { key: "client_category", header: "Категория клиента" },
    { key: "territory", header: "Территория" },
    { key: "user_name", header: "Пользователь" },
    { key: "category", header: "Категория отчета" },
    { key: "status_label", header: "Статус" }
  ],
  totalsKeys: [],
  rowKey: "photo_id",
  countLabel: "Всего",
  showTableFooter: false,
  clientTableSearch: {
    rowKeys: ["client_name", "client_code", "user_name", "category", "territory"],
    placeholder: "Фильтр в таблице…"
  },
  formatters: {
    created_at: (v) => fmtDt(v),
    user_name: (v, row) => {
      const name = String(v ?? "") || "—";
      const role = String(row.user_role ?? "");
      return role ? `${name} (${role})` : name;
    }
  }
};

export default function ReportPhotoPage() {
  return <FlatReportPage {...config} />;
}
