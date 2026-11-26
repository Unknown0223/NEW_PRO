"use client";

import { FlatReportPage } from "@/components/reports/flat-report/flat-report-page";
import type { FlatReportConfig } from "@/components/reports/flat-report/types";

const config: FlatReportConfig = {
  title: "Детальный отчет по скидкам",
  apiPath: "discount-detail",
  exportPermission: "reports.detalnyy_skidki.export",
  exportFilename: "detalnyy-skidki.xlsx",
  tablePrefsId: "report.discount-detail.v1",
  filterGridCols: 9,
  filterFields: [
    { kind: "dateRange" },

    { kind: "multiSelect", paramKey: "agent_ids", optionsFrom: "agents", placeholder: "Агент" }
  ],
  columns: [
    { key: "row_number", header: "№", cellClassName: "text-muted-foreground" },
    { key: "order_date", header: "Дата" },
    { key: "order_number", header: "№ заказа", cellClassName: "font-medium" },
    { key: "client_name", header: "Клиент" },
    { key: "agent_name", header: "Агент" },
    { key: "discount_sum", header: "Скидка", align: "right", format: "money" },
    { key: "total_sum", header: "Сумма", align: "right", format: "money" },
    { key: "status", header: "Статус", format: "orderStatus" }
  ],
  totalsKeys: ["discount_sum", "total_sum"],
  totalsLabels: { discount_sum: "Скидка", total_sum: "Сумма" },
  rowKey: "order_id",
  countLabel: "Заказов",
  footerLeadColSpan: 5
};

export default function ReportDiscountDetailPage() {
  return <FlatReportPage {...config} />;
}
