"use client";

/**
 * FlatReport wave-4 adapter (ADR-010 / ADR-012).
 * Parity: filtrlar ha · chrome ha · oylik/dialog — · export+RBAC ha
 */
import { FlatReportPage } from "@/components/reports/flat-report/flat-report-page";
import type { FlatReportConfig } from "@/components/reports/flat-report/types";

const config: FlatReportConfig = {
  title: "Визиты экспедиторов",
  apiPath: "expeditor-visits",
  exportPermission: "reports.vizity_ekspedirov.export",
  exportFilename: "vizity-ekspedirov.xlsx",
  tablePrefsId: "report.expeditor-visits.v1",
  filterGridCols: 9,
  filterFields: [
    { kind: "dateRange" },

    {
      kind: "multiSelect",
      paramKey: "expeditor_ids",
      optionsFrom: "expeditors",
      placeholder: "Экспедитор"
    }
  ],
  columns: [
    { key: "row_number", header: "#", cellClassName: "text-muted-foreground" },
    { key: "expeditor_name", header: "Доставщик", cellClassName: "font-medium" },
    { key: "planned", header: "Плановый визит", align: "right", format: "number" },
    { key: "visited", header: "Посещено", align: "right", format: "number" },
    { key: "no_visited", header: "Не посещено", align: "right", format: "number" },
    { key: "order_count", header: "Доставка фактов", align: "right", format: "number" },
    { key: "defect_count", header: "Полный возврат", align: "right", format: "number" },
    { key: "payment_sum", header: "Оплата", align: "right", format: "money" }
  ],
  totalsKeys: ["planned", "visited", "no_visited", "payment_sum"],
  totalsLabels: {
    planned: "План",
    visited: "Посещено",
    no_visited: "Не посещено",
    payment_sum: "Оплата"
  },
  rowKey: "expeditor_id",
  countLabel: "Всего",
  showTableFooter: false,
  clientTableSearch: {
    rowKeys: ["expeditor_name"],
    placeholder: "Фильтр в таблице…"
  }
};

export default function ReportExpeditorVisitsPage() {
  return <FlatReportPage {...config} />;
}
