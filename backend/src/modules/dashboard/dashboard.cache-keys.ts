/** Redis kalitlari — `redis-cache` bilan aylanma import bo‘lmasin. */

export function dashboardCacheKey(tenantId: number): string {
  return `tenant:${tenantId}:dashboard`;
}

export function dashboardCacheKeyPrefixes(tenantId: number): string[] {
  return [`tenant:${tenantId}:dashboard`, `t:${tenantId}:dashboard`];
}

export function isDashboardCacheKeyForTenant(tenantId: number, key: string): boolean {
  for (const prefix of dashboardCacheKeyPrefixes(tenantId)) {
    if (key === prefix || key.startsWith(`${prefix}:`)) return true;
  }
  return false;
}
