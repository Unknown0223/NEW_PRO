"use client";

import { DiscountOrdersReportPage } from "@/components/reports/discount-orders-report-page";

export default function ReportDiscountDetailPage() {
  return (
    <DiscountOrdersReportPage
      title="Детальный отчет по скидкам"
      apiPath="discount-detail"
      exportPermission="reports.detalnyy_skidki.export"
      exportFilename="detalnyy-skidki.xlsx"
    />
  );
}