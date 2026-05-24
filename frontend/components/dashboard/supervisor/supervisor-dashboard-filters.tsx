"use client";

import type { ReactNode } from "react";

export function SupervisorDashboardFiltersSection({ children }: { children: ReactNode }) {
  return <div data-dashboard-section="supervisor-filters">{children}</div>;
}
