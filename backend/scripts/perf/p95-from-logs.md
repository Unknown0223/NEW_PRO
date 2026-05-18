# P95 o‘lchash (slow query inventory uchun)

Maqsad: `.cursor/plans/db_slow_query_inventory.md` jadvalidagi **P95 (ms)** ustunini to‘ldirish.

## 1. Application log (`slow_request`)

Backend: `request-observability.plugin.ts` — `responseTimeMs >= 500` → `slow_request` (warn).

**Loki (misol):**

```logql
{app="salec-backend"} |= "request_complete"
| json
| path=~"/api/.*/orders"
| quantile_over_time(0.95, responseTimeMs[7d]) by (path)
```

**Qo‘lda (JSON log fayl):** `npm run perf:p95` (`scripts/perf/summarize-p95-from-log.ps1`) — har bir `path` uchun P95 va max ms chiqaradi.

**Seed DB (dev, supertest):** `npm run perf:sample-p95` — `test1` admin bilan asosiy GET marshrutlar; chiqish: `logs/foundation-p95-samples.json`.

## 2. Dashboard maxsus

`DASHBOARD_PERF_LOG=1` — `dashboard.request` loglari va `X-Dashboard-Duration-Ms` sarlavhasi (`dashboard-perf-log.ts`).

## 3. PostgreSQL

`log_min_duration_statement = '500ms'` — sekin SQL; `EXPLAIN` bilan bog‘lash. Batafsil: `docs/SLO_AND_OBSERVABILITY.md`.

## 4. Inventory ga yozish

Har bir qator uchun: **P95 (ms)** | manba (log sanasi / muhit) | izoh (masalan, «filter bilan og‘ir»).
