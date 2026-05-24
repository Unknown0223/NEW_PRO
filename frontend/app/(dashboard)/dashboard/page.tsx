import dynamic from "next/dynamic";
import { DashboardPageSkeleton } from "@/components/dashboard/dashboard-page-skeleton";

const DashboardHome = dynamic(
  () => import("@/components/dashboard/dashboard-home").then((m) => m.DashboardHome),
  { loading: () => <DashboardPageSkeleton /> }
);

export default function DashboardPage() {
  return <DashboardHome />;
}
