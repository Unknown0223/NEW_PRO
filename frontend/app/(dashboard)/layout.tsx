import { AppShell } from "@/components/dashboard/app-shell";
import { RouteAccessGate } from "@/components/access/route-access-gate";
import { SessionWatcher } from "@/components/dashboard/session-watcher";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { ActivityTrackerProvider } from "@/lib/activity-tracker";
import type { ReactNode } from "react";
import { Suspense } from "react";

export default function DashboardGroupLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<RouteLoadingFallback rootLayout />}>
      <ActivityTrackerProvider>
        <SessionWatcher />
        <AppShell>
          <RouteAccessGate>{children}</RouteAccessGate>
        </AppShell>
      </ActivityTrackerProvider>
    </Suspense>
  );
}
