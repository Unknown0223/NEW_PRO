"use client";

import { DiscountOrdersReportPage } from "@/components/reports/discount-orders-report-page";

export default function ReportUniversalDiscountsPage() {
  return (
    <DiscountOrdersReportPage
      title="Универсальный отчет по скидкам"
      apiPath="universal-discounts"
      exportPermission="reports.universalnyy_skidki.export"
      exportFilename="universalnyy-skidki.xlsx"
    />
  );
}