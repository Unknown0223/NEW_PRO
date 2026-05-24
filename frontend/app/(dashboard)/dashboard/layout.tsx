import { DashboardMetaPrefetch } from "@/components/dashboard/dashboard-meta-prefetch";

export default function DashboardSectionLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <DashboardMetaPrefetch />
      {children}
    </>
  );
}
