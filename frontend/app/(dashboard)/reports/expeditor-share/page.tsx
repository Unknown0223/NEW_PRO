"use client";

/**
 * FlatReport wave-4 adapter (ADR-010 / ADR-012).
 * Parity: filtrlar ha · chrome ha · oylik/dialog — · export+RBAC ha
 */
import { FlatReportPage } from "@/components/reports/flat-report/flat-report-page";
import type { FlatReportConfig } from "@/components/reports/flat-report/types";

const config: FlatReportConfig = {
  title: "Доли по экспедиторам",
  apiPath: "expeditor-share",
  exportPermission: "reports.doli_ekspedirov.export",
  exportFilename: "doli-ekspedirov.xlsx",
  tablePrefsId: "report.expeditor-share.v1",
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
    { key: "order_count", header: "Заказы", align: "right", format: "number" },
    { key: "sales_sum", header: "Продажи", align: "right", format: "money" },
    { key: "share_pct", header: "Доля, %" },
    { key: "client_count", header: "АКБ", align: "right", format: "number" },
    { key: "payment_sum", header: "Оплата", align: "right", format: "money" }
  ],
  totalsKeys: ["order_count", "sales_sum", "client_count", "payment_sum"],
  totalsLabels: {
    order_count: "Заказы",
    sales_sum: "Продажи",
    client_count: "АКБ",
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

export default function ReportExpeditorSharePage() {
  return <FlatReportPage {...config} />;
}
