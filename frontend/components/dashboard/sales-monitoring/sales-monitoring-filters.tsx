"use client";

/** Filter panel shell — full filter UI remains in dashboard-sales-monitoring orchestrator until incremental move. */
export function SalesMonitoringFiltersSection({ children }: { children: React.ReactNode }) {
  return <div data-dashboard-section="sales-monitoring-filters">{children}</div>;
}
