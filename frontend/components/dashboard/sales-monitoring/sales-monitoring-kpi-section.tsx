"use client";

import { SalesMonitoringKpiSkeleton } from "@/components/dashboard/sales-monitoring/sales-monitoring-kpi-skeleton";

export function SalesMonitoringKpiSection({
  loading,
  children
}: {
  loading?: boolean;
  children: React.ReactNode;
}) {
  if (loading) return <SalesMonitoringKpiSkeleton cards={6} />;
  return <div data-dashboard-section="sales-monitoring-kpi">{children}</div>;
}
