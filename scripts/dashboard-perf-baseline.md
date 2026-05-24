# Dashboard perf baseline va runbook

4 ta dashboard sahifasi uchun o‘lchash shablon va production diagnostika.

## Sozlash

Backend `.env`:

```
DASHBOARD_PERF_LOG=1
DASHBOARD_SNAPSHOT_CACHE_TTL_SECONDS=90
```

## O‘lchash (DevTools → Network, cache disable)

| Sahifa | Route | Mount so‘rovlar | Asosiy endpoint | TTFB (ms) | JSON (KB) |
|--------|-------|-----------------|-----------------|-----------|-----------|
| Supervisor | `/dashboard` | meta + summary | `/dashboard/supervisor/summary` | | |
| Savdo | `/dashboard/sales` | meta + summary | `/dashboard/sales/summary` | | |
| Moliya | `/dashboard/finance` | meta + summary | `/dashboard/finance/summary` | | |
| Plan/fakt | `/dashboard/sales-monitoring` | meta + summary | `/dashboard/sales-monitoring/summary` | | |

Backend javob header: `X-Dashboard-Duration-Ms`

## Maqsad (optimizatsiya keyin)

- Mount: **1× meta** + **1× summary** (qolgan bo‘limlar lazy)
- Snapshot cache miss ≤ 800 ms; hit ≤ 100 ms
- Birinchi KPI ≤ 1.5 s

## Split API (Hafta 2–4)

| Dashboard | Summary | Lazy bo‘limlar |
|-----------|---------|----------------|
| Plan/fakt | `/sales-monitoring/summary` | `/charts`, `/tables?page&limit` |
| Supervisor | `/supervisor/summary` | `/visits`, `/products` |
| Savdo | `/sales/summary` | `/analytics`, `/breakdown?page&limit` |
| Moliya | `/finance/summary` | `/debts?page&limit` |

Legacy monolit endpointlar (`/supervisor`, `/sales`, …) backward compatibility uchun saqlangan.

## Sekin snapshot diagnostika

1. `DASHBOARD_PERF_LOG=1` — server logda `route` + `durationMs`
2. Network: `X-Dashboard-Duration-Ms` header
3. Cache miss takrorlanmasa: Redis TTL (`DASHBOARD_SNAPSHOT_CACHE_TTL_SECONDS`) va filter o‘zgarishi
4. DB: `durationMs` > 800 ms bo‘lsa staging da `EXPLAIN (ANALYZE, BUFFERS)` — `orders` + `order_items` scope

## Frontend optimizatsiya

- Sahifalar: `next/dynamic` + `DashboardPageSkeleton`
- React Query: `staleTime: STALE.report` (2 min)
- Jadvallar 100+ qator: `@tanstack/react-virtual` (moliya clients debt)
- Chart: `dynamic()` import (sales/finance pie/trend)

## CI smoke

`backend/tests/contract-smoke.integration.dashboard.test.ts` — summary endpointlar 200 + minimal schema.
