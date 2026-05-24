# Dashboard perf o'lchash (DevTools)

1. Backend: `DASHBOARD_PERF_LOG=1`, `DASHBOARD_SNAPSHOT_CACHE_TTL_SECONDS=90`
2. Chrome DevTools → Network → Disable cache
3. Har sahifani birinchi marta oching (hard refresh)

| Sahifa | Mount so'rovlar | Summary TTFB (ms) | X-Dashboard-Duration-Ms | JSON KB |
|--------|-----------------|-------------------|-------------------------|---------|
| /dashboard | meta + supervisor/summary | | | |
| /dashboard/sales | meta + sales/summary | | | |
| /dashboard/finance | meta + finance/summary | | | |
| /dashboard/sales-monitoring | meta + SM/summary | | | |

Scroll qiling: charts/tables alohida yuklanishi kerak (IO).
