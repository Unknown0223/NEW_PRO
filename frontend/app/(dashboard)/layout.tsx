import { AppShell } from "@/components/dashboard/app-shell";
import { RouteAccessGate } from "@/components/access/route-access-gate";
import { WebPanelDeniedGate } from "@/components/access/web-panel-denied-gate";
import { SessionWatcher } from "@/components/dashboard/session-watcher";
import { RouteLoadingFallback } from "@/components/ui/route-loading-fallback";
import { WorkdayOffGate } from "@/components/workdays/workday-off-gate";
import { ActivityTrackerProvider } from "@/lib/activity-tracker";
import type { ReactNode } from "react";
import { Suspense } from "react";

export default function DashboardGroupLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<RouteLoadingFallback rootLayout />}>
      <ActivityTrackerProvider>
        <WebPanelDeniedGate>
          <SessionWatcher />
          <WorkdayOffGate>
            <AppShell>
              <RouteAccessGate>{children}</RouteAccessGate>
            </AppShell>
          </WorkdayOffGate>
        </WebPanelDeniedGate>
      </ActivityTrackerProvider>
    </Suspense>
  );
}
