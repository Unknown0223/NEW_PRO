# Performance: SQL profiling (P0)

Bu papkadagi SQL namunalari **staging yoki nusxa DB**da `psql` orqali ishlatiladi. Natijada `EXPLAIN (ANALYZE, BUFFERS)` rejasi, `Seq Scan` / `Index Scan` va `actual time` qatorlarini qidiring.

## O‘zgaruvchilar

Har bir `.sql` fayl boshida `SET` qatorlari: `tenant_id`, sana diapazoni va ixtiyoriy `agent_id` ni o‘z ma’lumotingizga moslang.

## Barcha namunalar (Windows)

`DATABASE_URL` o‘rnatilgan holda: `npm run perf:explain` (`scripts/perf/run-all-explain.ps1`).

**Foundation operatsion:** `npm run foundation:ops` — EXPLAIN + ixtiyoriy P95 (`run-foundation-ops.ps1`).

## Tartib

1. `explain-dashboard-sales-scope.sql` — savdo dashboard asosiy join (`orders` + `order_items` + `users` + `clients`).
2. `explain-linkage-agent-sold-products.sql` — zakaz formasi agent katalogi (`order_items` + `orders`, `GROUP BY product_id`).
3. `explain-orders-list-paged.sql` — zakazlar ro‘yxati (`GET /api/:slug/orders`) uchun soddalashtirilgan `tenant_id` + sana + `ORDER BY created_at` + `LIMIT`.
4. `explain-dashboard-supervisor-order-scope.sql` — supervayzer dashboard kunlik `orderScope` (orders + users + clients).
5. `explain-clients-list-paged.sql` — mijozlar ro‘yxati (`GET /api/:slug/clients`).
6. `explain-products-list-paged.sql` — mahsulotlar ro‘yxati (`GET /api/:slug/products`).
7. `explain-stock-balances-summary.sql` — qoldiqlar (`GET /api/:slug/stock/balances`, raw lines).
8. `explain-reports-sales.sql` — savdo hisoboti (`GET /api/:slug/reports/sales`).

**P95:** `p95-from-logs.md` — `slow_request` loglaridan inventory jadvalini to‘ldirish.  
Windows: `Get-Content .\logs\app.log -Tail 20000 | npm run perf:p95` yoki `npm run perf:p95 -- -Path .\logs\app.log`.

**API P95 (seed DB):** `npm run perf:sample-p95` — to‘liq ro‘yxat → `logs/foundation-p95-samples.json`.

**Tez P95 (~1–2 min):** `npm run perf:sample-p95:quick` → `logs/foundation-p95-quick.json` (5 marshrut, dashboardsiz).

**Dev UI log (start-dev):** `Get-Content ..\..\terminals\4.txt -Tail 3000 | npm run perf:p95` — pino-pretty format qo‘llab-quvvatlanadi.

**Order-debts benchmark:** `npm run perf:bench-order-debts` — warmup + 3 o‘lchov.  
**Arxiv:** `EXPLAIN_ARCHIVE.md` — before/after xulosalari.

## Indeks migratsiyalari (dashboard)

| Migratsiya | Sabab |
|------------|--------|
| `20260506160000_supervisor_dashboard_perf_indexes` | Reja / vizit / foto (GIN visit_weekdays) |
| `20260508121500_dashboard_perf_supporting_indexes` | agent_visits, client_photo_reports, client_payments |
| `20260511120000_orders_perf_dashboard_linkage` | orders (tenant, type, agent, created_at), order_items, users |
| `20260515120000_dashboard_supervisor_users_index` | `users(tenant_id, supervisor_user_id)` qayta tiklash; `clients` dashboard filtrlari |

`EXPLAIN` chiqimini PR tavsiyasi yoki Linear izohiga qo‘ying (inventory: `.cursor/plans/db_slow_query_inventory.md`).

Keyin `backend/prisma/migrations` ostidagi yangi migratsiya bilan indekslarni qo‘shishdan oldin reja va `actual rows` ni solishtiring.

**Zakaz konteksti (ixtiyoriy):** backendda `ORDER_CREATE_CONTEXT_DEBUG=1` bo‘lsa `getOrderCreateContextBundle` qaysi kesimlar ishlaganini loglaydi.
