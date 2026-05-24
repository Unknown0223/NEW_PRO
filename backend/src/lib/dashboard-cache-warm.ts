import { prisma } from "../config/database";
import { env } from "../config/env";
import { getSalesMonitoringSummary } from "../modules/dashboard/sales-monitoring.snapshot.partials";
import { parseSalesMonitoringFilters } from "../modules/dashboard/sales-monitoring.filters";

const WARM_INTERVAL_MS = 120_000;

let warmTimer: ReturnType<typeof setInterval> | null = null;

async function warmDefaultSalesMonitoringForTenant(tenantId: number): Promise<void> {
  const now = new Date();
  const filters = parseSalesMonitoringFilters({
    year: String(now.getUTCFullYear()),
    month: String(now.getUTCMonth() + 1)
  });
  await getSalesMonitoringSummary(tenantId, filters);
}

export async function runDashboardCacheWarm(): Promise<void> {
  if (env.DASHBOARD_CACHE_WARMING !== "1") return;
  const tenants = await prisma.tenant.findMany({
    where: { is_active: true },
    select: { id: true },
    take: 50
  });
  for (const t of tenants) {
    try {
      await warmDefaultSalesMonitoringForTenant(t.id);
    } catch (err) {
      console.error("[dashboard-cache-warm] tenant", t.id, err);
    }
  }
}

export function enableDashboardCacheWarm(): void {
  if (env.DASHBOARD_CACHE_WARMING !== "1") return;
  if (warmTimer != null) return;
  warmTimer = setInterval(() => {
    void runDashboardCacheWarm();
  }, WARM_INTERVAL_MS);
  void runDashboardCacheWarm();
  console.log("[dashboard-cache-warm] enabled (interval %d ms)", WARM_INTERVAL_MS);
}

export function disableDashboardCacheWarm(): void {
  if (warmTimer != null) {
    clearInterval(warmTimer);
    warmTimer = null;
  }
}
