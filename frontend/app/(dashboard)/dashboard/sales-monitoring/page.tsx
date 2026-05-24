import dynamic from "next/dynamic";
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-page-skeleton";

const DashboardSalesMonitoring = dynamic(
  () =>
    import("@/components/dashboard/dashboard-sales-monitoring").then((m) => m.DashboardSalesMonitoring),
  { loading: () => <DashboardPageSkeleton /> }
);

export default function DashboardSalesMonitoringPage() {
  return <DashboardSalesMonitoring />;
}
