import dynamic from "next/dynamic";
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-page-skeleton";

const DashboardSales = dynamic(
  () => import("@/components/dashboard/dashboard-sales").then((m) => m.DashboardSales),
  { loading: () => <DashboardPageSkeleton /> }
);

export default function DashboardSalesPage() {
  return <DashboardSales />;
}
