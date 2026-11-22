"use client";

import { Suspense } from "react";
import { StaffAttendanceReportWorkspace } from "@/components/reports/staff-attendance-report-workspace";

export default function StaffAttendanceReportPage() {
  return (
    <Suspense fallback={<div className="p-4 text-sm text-muted-foreground">Загрузка…</div>}>
      <StaffAttendanceReportWorkspace />
    </Suspense>
  );
}
