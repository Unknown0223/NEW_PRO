import { getSnapshotCache, setSnapshotCache, stableJsonStringify } from "./dashboard.cache";
import type { SalesMonitoringFilters, SalesMonitoringSnapshot } from "./sales-monitoring.types";
import { buildSalesMonitoringBase } from "./sales-monitoring.snapshot.base";
import { buildSalesMonitoringSnapshotRest } from "./sales-monitoring.snapshot.rest";

export async function getSalesMonitoringSnapshot(
  tenantId: number,
  filters: SalesMonitoringFilters
): Promise<SalesMonitoringSnapshot> {
  const snapshotKey = `tenant:${tenantId}:dashboard:sales-monitoring:${stableJsonStringify(filters)}`;
  const cached = await getSnapshotCache<SalesMonitoringSnapshot>(snapshotKey);
  if (cached) return cached;
  const base = await buildSalesMonitoringBase(tenantId, filters);
  const result = await buildSalesMonitoringSnapshotRest(base);
  await setSnapshotCache(snapshotKey, result);
  return result;
}
