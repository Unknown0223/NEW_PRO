"use client";

import { ClientReconciliationWorkspace } from "@/components/reports/client-reconciliation-workspace";
import { Suspense } from "react";

export default function ClientReconciliationReportPage() {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Загрузка…</div>}>
      <ClientReconciliationWorkspace />
    </Suspense>
  );
}
