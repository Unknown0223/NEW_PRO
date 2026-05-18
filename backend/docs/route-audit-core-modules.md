# Marshrut audit: orders, dashboard, stock (P1 kengaytirish)

**Sana:** 2026-05-15  
**Naqsh:** `rbac-route-pattern.md`  
**Avvalgi audit:** `route-audit-clients-reports.md`

## Xulosa (`npm run audit:route-tenant`)

| Fayl | Marshrutlar | Tenant | RBAC xulosasi |
|------|-------------|--------|---------------|
| `orders.route.ts` | 12 | ✅ | `jwtAccessVerify` + rol/skladchik `preHandler` lar; yozuvlar `catalogRoles` yoki skladchik entitlement |
| `dashboard.route.ts` | 5 | ✅ | `requireAnyPermission` + legacy dashboard kalitlari; supervisor scope handler ichida |
| `stock.route.ts` | 22 | ✅ | Ombor operatsiyalari — rol/ruxsat `preHandler` da |
| `goods-receipt.route.ts` | 7 | ✅ | |
| `warehouse-transfers.route.ts` | 8 | ✅ | |
| `retail-stock.route.ts` | 4 | ✅ | |
| `suppliers.route.ts` | 9 | ✅ | |
| `warehouse-blocks.route.ts` | 7 | ✅ | |
| `stock-takes.route.ts` | 6 | ✅ | |

**Jami:** 73 marshrut (stock modullari bilan), barchasida `ensureTenantContext`.

## `orders.route.ts`

- Kontraktlar: `contracts/orders.schemas.ts` (`POST`, list query).
- Og‘ir o‘qish: `GET /orders` → `listOrdersPaged` (inventory + `explain-orders-list-paged.sql`).

## `dashboard.route.ts`

- Namuna RBAC: `DASHBOARD_ANY_LEGACY` + `requireAnyPermission`.
- Perf: `recordDashboardPerf` + `DASHBOARD_PERF_LOG=1`; indekslar `20260515120000_dashboard_supervisor_users_index`.
- Supervisor: URL `supervisor_ids` override — faqat `role === "supervisor"` uchun o‘z ID.

## Stock modullari

- Ko‘p marshrut — alohida `requirePermission` / rol naqshlari fayl bo‘yicha; tenant har handlerda.
- Inventory: `GET /stock/...` — `db_slow_query_inventory.md` da alohida qator.

## `linkage`, `mobile`, `access` (2026-05-15)

| Fayl | Marshrutlar | Tenant |
|------|-------------|--------|
| `linkage.route.ts` | 1 | ✅ |
| `mobile.route.ts` | 6 | ✅ |
| `access.route.ts` | 15 | ✅ |

`access` — `requirePermission("access.manage")` va boshqalar; `mobile` — agent maydoni JWT + tenant.

## `products`, `payments` (2026-05-15)

| Fayl | Marshrutlar | Tenant |
|------|-------------|--------|
| `products.route.ts` | 14 | ✅ |
| `product-catalog.route.ts` | 9 | ✅ |
| `product-prices.route.ts` | 7 | ✅ |
| `price-matrix.route.ts` | 5 | ✅ |
| `payments.route.ts` | 14 | ✅ |

## `field`, `staff` (2026-05-15)

| Fayl | Marshrutlar | Tenant |
|------|-------------|--------|
| `field.route.ts` | 6 | ✅ |
| `staff.route.ts` | 58 | ✅ |

## `cash-desks` (2026-05-15)

| Fayl | Marshrutlar | Tenant |
|------|-------------|--------|
| `cash-desks.route.ts` | 10 | ✅ |

## Keyingi audit

`products` catalog helper marshrutlari, `field.route.ts` chuqur RBAC.
