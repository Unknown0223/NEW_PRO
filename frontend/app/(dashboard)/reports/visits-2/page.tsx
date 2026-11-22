"use client";

/**
 * FlatReport wave-5 adapter (ADR-010 / ADR-012).
 * Parity: filtrlar qisman (territory cascade / sort UI yo‘q; product_category_refs) · chrome ha ·
 * oylik/dialog — · export+RBAC ha
 */
import { FlatReportPage } from "@/components/reports/flat-report/flat-report-page";
import type { FlatReportConfig } from "@/components/reports/flat-report/types";

function fmtVisit(iso: unknown) {
  if (iso == null || iso === "") return "—";
  try {
    return new Date(String(iso)).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return String(iso);
  }
}

const config: FlatReportConfig = {
  title: "По визитам 2.0",
  apiPath: "visits-2",
  exportPermission: "reports.vizity.export",
  exportFilename: "po-vizitam-2.xlsx",
  defaultLimit: 10,
  filterFields: [
    { kind: "dateRange" },
    { kind: "search", placeholder: "Клиент / агент / телефон" },
    { kind: "multiSelect", paramKey: "agent_ids", optionsFrom: "agents", placeholder: "Агент" },
    {
      kind: "multiSelect",
      paramKey: "client_categories",
      optionsFrom: "client_categories",
      placeholder: "Категория клиента"
    },
    {
      kind: "multiSelect",
      paramKey: "weekdays",
      optionsFrom: "weekdays",
      placeholder: "День визита"
    },
    {
      kind: "multiSelect",
      paramKey: "product_category_refs",
      optionsFrom: "product_categories",
      placeholder: "Категория товара"
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
    { key: "client_id", header: "ID", cellClassName: "text-muted-foreground" },
    { key: "client_name", header: "Клиент", cellClassName: "font-medium" },
    { key: "client_phone", header: "Телефон" },
    { key: "agent_name", header: "Агент" },
    { key: "visit_day_label", header: "День" },
    { key: "last_visit_at", header: "Посл. визит" },
    { key: "territory", header: "Территория" }
  ],
  totalsKeys: [],
  rowKey: "client_id",
  countLabel: "Клиентов",
  showTableFooter: false,
  formatters: {
    last_visit_at: (v) => fmtVisit(v),
    client_phone: (v) => String(v ?? "") || "—",
    territory: (v) => String(v ?? "") || "—"
  }
};

export default function ReportVisits2Page() {
  return <FlatReportPage {...config} />;
}
