import dynamic from "next/dynamic";
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-page-skeleton";

const DashboardFinance = dynamic(
  () => import("@/components/dashboard/dashboard-finance").then((m) => m.DashboardFinance),
  { loading: () => <DashboardPageSkeleton /> }
);

export default function DashboardFinancePage() {
  return <DashboardFinance />;
}
