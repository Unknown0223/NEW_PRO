# EXPLAIN arxivi

Har bir indeks PR yoki tezlik ishidan keyin qisqa xulosa. Jadval: `.cursor/plans/db_slow_query_inventory.md`.

**Oxirgi to‘liq o‘tkazish:** 2026-05-15 — local Docker `savdo_postgres`, `tenant_id=1`, `npm run perf:explain`.

| Fayl | Execution Time (ANALYZE) | Asosiy rejim |
|------|--------------------------|--------------|
| explain-dashboard-sales-scope.sql | 0.128 ms | Index Scan `orders_tenant_id_order_type_created_at_idx` |
| explain-dashboard-supervisor-order-scope.sql | 0.065 ms | Index Scan (orderScope) |
| explain-orders-list-paged.sql | 0.055 ms | Index Scan + LIMIT |
| explain-clients-list-paged.sql | 0.109 ms | Index / sort |
| explain-clients-references.sql | 432 ms | Seq Scan (barcha ustunlar, dev hajm) — API cache bilan ~6 ms P95 |
| explain-products-list-paged.sql | 0.652 ms | Eng sekin namuna (dev DB) |
| explain-stock-balances-summary.sql | 0.359 ms | Join / agregat |
| explain-linkage-agent-sold-products.sql | 0.144 ms | `orders` + `order_items` index |
| explain-reports-sales.sql | 0.237 ms | Seq Scan `orders` (613 qator, tenant_id=1) |
| explain-report-builder-orders-aggregate.sql | 0.833 ms | HashAggregate + join (namuna) |
| explain-reports-order-debts.sql | ~1.3 ms | CTE alloc/ship/base (tenant=1) |

> SQL plan vaqti — dev DB. **API P95 (dev):** `npm run perf:sample-p95` → `logs/foundation-p95-samples.json`. **Prod:** `npm run perf:p95`.

---

### 2026-05-15 — `GET /api/:slug/dashboard/sales`

- **Fayl:** `explain-dashboard-sales-scope.sql`
- **Muhit:** local Docker, `tenant_id=1`
- **Rejim:** Index Scan `orders_tenant_id_order_type_created_at_idx` (filter: status, created_at)
- **actual time:** ~0.13 ms (Execution Time)
- **Indeks:** `20260511120000_orders_perf_dashboard_linkage` va bog‘liqlari

---

### 2026-05-15 — `GET /api/:slug/dashboard/supervisor` (orderScope)

- **Fayl:** `explain-dashboard-supervisor-order-scope.sql`
- **Muhit:** local, `tenant_id=1`
- **actual time:** ~0.065 ms
- **Indeks:** `20260515120000_dashboard_supervisor_users_index` (users + clients)

---

### 2026-05-15 — `GET /api/:slug/orders` (list)

- **Fayl:** `explain-orders-list-paged.sql`
- **actual time:** ~0.055 ms
- **Izoh:** `ORDER BY created_at DESC LIMIT 50` — index qamrab oladi

---

### 2026-05-15 — `GET /api/:slug/clients` (list)

- **Fayl:** `explain-clients-list-paged.sql`
- **actual time:** ~0.11 ms

---

### 2026-05-15 — `GET /api/:slug/products` (list)

- **Fayl:** `explain-products-list-paged.sql`
- **actual time:** ~0.65 ms — profilingda birinchi tekshirish nomzodi

---

### 2026-05-15 — `GET /api/:slug/stock/balances`

- **Fayl:** `explain-stock-balances-summary.sql`
- **actual time:** ~0.36 ms

---

### 2026-05-15 — linkage agent sold products

- **Fayl:** `explain-linkage-agent-sold-products.sql`
- **actual time:** ~0.14 ms
- **Indeks:** `orders_tenant_order_type_agent_created_at_idx`, `order_items_order_id_idx`

---

### 2026-05-15 — `GET /api/:slug/reports/sales`

- **Fayl:** `explain-reports-sales.sql`
- **actual time:** ~0.24 ms
- **Eslatma:** kichik DB da Seq Scan; productionda indeks + filter bilan qayta o‘lchash

---

*Yangi yozuvlarni «Shablon» dan keyin qo‘shing (eng yangisi yuqorida).*
