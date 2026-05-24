"use client";

import { CashFlowWorkspace } from "@/components/reports/cash-flow-workspace";
import { Suspense } from "react";

export default function CashFlowReportPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Загрузка…</div>}>
      <CashFlowWorkspace />
    </Suspense>
  );
}
