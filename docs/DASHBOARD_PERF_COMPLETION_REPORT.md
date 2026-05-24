# Dashboard optimizatsiya — yakuniy hisobot

Sana: 2026-05-19  
Reja: 4 hafta + 100% yakunlash (`dashboard_100%_yakun`)

## Qilingan (kod)

### Oldingi sessiyadan (asosiy arxitektura)
- [x] `GET /api/:slug/dashboard/meta` + `useDashboardMeta` (4 sahifa)
- [x] `next/dynamic` + `DashboardPageSkeleton` (4 `page.tsx`)
- [x] `dashboard/layout.tsx` + meta prefetch
- [x] Redis TTL 60s, React Query `STALE.report`
- [x] Split API: supervisor, sales, finance, sales-monitoring (summary/charts/tables)
- [x] Frontend `summaryQ` + qisman lazy (supervisor visits/products, sales/finance split)

### Ushbu sessiyada (100% yakun)
- [x] `useDashboardSectionVisible` — IntersectionObserver
- [x] Sales-monitoring: `chartsQ` / `branchTablesQ` / `supervisorTablesQ` / `skuTablesQ` / `clientDailyTablesQ` faqat viewportda
- [x] Backend `table=sku_matrix|branch|supervisor|client_daily|all` + server pagination
- [x] Legacy `GET /sales-monitoring` — `X-Deprecated-Endpoint` + log
- [x] `analytics-charts-lazy.tsx` (Recharts dynamic)
- [x] 4× dashboard skeleton primitivlari + 12 ta skeleton re-export fayl
- [x] Section fayllar (SM, supervisor, sales) — poydevor + `data-dashboard-section`
- [x] Supervisor `activeSection` default `null` (faqat summary mountda)
- [x] Sales `analyticsQ` / `breakdownQ` IO enabled
- [x] Finance virtual scroll (mavjud), `useDashboardVirtualRows` helper
- [x] `dashboard-cache-warm.ts` + `DASHBOARD_CACHE_WARMING` env
- [x] `backend/scripts/dashboard-explain.sql`, `scripts/dashboard-explain-results.md`
- [x] `scripts/dashboard-perf-capture.md`
- [x] CI smoke kengaytirildi (`contract-smoke.integration.dashboard.test.ts`)

## Qilinmagan / tashqi qabul

| Band | Sabab |
|------|--------|
| KPI ≤1.5s, TTFB ≥50% | Staging/prod o‘lchov — `scripts/dashboard-perf-capture.md` jadvalini to‘ldiring |
| EXPLAIN natijalari raqamlari | Staging DB da SQL ishga tushirish kerak |
| CTE SQL birlashtirish | Faqat EXPLAIN sekinlik ko‘rsatsa; shablon tayyor |
| To‘liq monolit → section ko‘chirish (2600 qator) | Perf-first section wrapper; mantiq orchestrator da qoldi |
| Visit/agent jadval UI ga virtual integratsiya | Helper + `SupervisorVisitsSection` mavjud; home hali `paginateRows` |
| `React.memo` har qator UI da | `SupervisorVisitTableRow` memo export; to‘liq wiring keyingi qadam |
| 400-qator audit (barcha dashboard fayllar) | Alohida refaktor rejasi |

## Mount pattern (kutilgan)

| Sahifa | Birinchi yuklash | Scroll/ochish |
|--------|------------------|---------------|
| Plan/fakt | meta + summary | charts, branch, supervisor, sku, client_daily |
| Supervisor | meta + summary | visits (tab), products (tab) |
| Savdo | meta + summary | analytics, breakdown |
| Moliya | meta + summary | debts |

## Tekshiruv

```bash
cd frontend && npm run typecheck
cd backend && npm run build   # dashboard modullari uchun
```

DB smoke: `backend/tests/.db-integration-ready` = `1` bo‘lsa `contract-smoke.integration.dashboard.test.ts`.

## Env

```
DASHBOARD_PERF_LOG=1
DASHBOARD_SNAPSHOT_CACHE_TTL_SECONDS=90
DASHBOARD_CACHE_WARMING=0   # stagingda 1 qilib sinash mumkin
```
