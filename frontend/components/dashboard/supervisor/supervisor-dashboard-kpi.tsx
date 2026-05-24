"use client";

import type { ReactNode } from "react";

export function SupervisorDashboardKpiSection({ children }: { children: ReactNode }) {
  return <div data-dashboard-section="supervisor-kpi">{children}</div>;
}
