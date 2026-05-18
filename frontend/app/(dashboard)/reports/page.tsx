"use client";

import { IncomeReportWorkspace } from "@/components/reports/income-report-workspace";
import { Suspense } from "react";

export default function ReportsPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Загрузка…</div>}>
      <IncomeReportWorkspace />
    </Suspense>
  );
}
