# SALEC - Katta Fayllar Ro'yxati (>400 qator)

**Sana:** 2026-yil 18-may  
**Maqsad:** Tizimni sekinligini tuzatish uchun katta fayllarni aniqlash

---

## Backend Fayllar (>400 qator)

### Orders Module (37 fayl, ~5500 qator)

| # | Fayl | Qator | Muammo | Priority |
|---|------|-------|--------|----------|
| 1 | `modules/orders/domain/order.lines.ts` | 363 | Line item manipulation | 🔴 |
| 2 | `modules/orders/domain/order.types.ts` | 361 | Type definitions | 🟡 |
| 3 | `modules/orders/domain/order.nakladnoy.ts` | 361 | Invoice generation | 🟡 |
| 4 | `modules/orders/order-create-context.service.ts` | 351 | Order context service | 🟡 |
| 5 | `modules/orders/domain/order.lifecycle.ts` | 340 | Status transitions | 🔴 |
| 6 | `modules/orders/domain/order.query.ts` | 337 | **CRITICAL - murakkab query** | 🔴 |
| 7 | `modules/orders/order-bonus-qty.ts` | 281 | Bonus calculation | 🟡 |
| 8 | `modules/orders/order-bonus-resolve.ts` | 272 | Bonus resolution | 🟡 |
| 9 | `modules/orders/order-nakladnoy-xlsx.consignment.ts` | 265 | Consignment nakladnoy | 🟢 |
| 10 | `modules/orders/domain/order.create.ts` | 254 | Order creation | 🟡 |

**Asosiy muammolar:**
- `order.query.ts` - 337 lines, N+1 pattern, murakkab joins
- `order.lifecycle.ts` - 340 lines, sequential stock updates
- `order.lines.ts` - 363 lines, type definitions aralash

---

### Clients Module (66 fayl, ~10686 qator)

| # | Fayl | Qator | Muammo | Priority |
|---|------|-------|--------|----------|
| 1 | `modules/clients/clients.import.assign.ts` | 367 | Import assignment | 🟡 |
| 2 | `modules/clients/clients.import.main.ts` | 364 | **Excel import - katta** | 🔴 |
| 3 | `modules/clients/client-assets.service.ts` | 361 | Client assets | 🟢 |
| 4 | `modules/clients/clients.merge.ts` | 357 | Client merge | 🟡 |
| 5 | `modules/clients/clients.list.ts` | 346 | Client list + audit | 🔴 |
| 6 | `modules/clients/clients.detail.ts` | 329 | Client detail N+1 | 🔴 |
| 7 | `modules/clients/clients.list.where.ts` | 322 | List filtering | 🟡 |
| 8 | `modules/clients/clients.import.rows-create.ts` | 308 | Import row creation | 🟡 |
| 9 | `modules/clients/clients.import.rows-update.ts` | 293 | Import row update | 🟡 |
| 10 | `modules/clients/client-balance-ledger.get.ts` | 288 | Balance ledger | 🟡 |

**Asosiy muammolar:**
- `clients.import.main.ts` - 364 lines, XLSX parsing + validation
- `clients.detail.ts` - 329 lines, 10+ sequential queries (N+1)
- `clients.list.ts` - 346 lines, sequential audit log writes

---

### Dashboard Module (29 fayl, ~4224 qator)

| # | Fayl | Qator | Muammo | Priority |
|---|------|-------|--------|----------|
| 1 | `modules/dashboard/dashboard.finance.snapshot.ts` | 366 | **14 raw queries, JS reduces** | 🔴🔴 |
| 2 | `modules/dashboard/dashboard.supervisor.scope.ts` | 360 | Scope filters | 🟡 |
| 3 | `modules/dashboard/dashboard.supervisor.snapshot-visits.query.ts` | 351 | Visit queries | 🟡 |
| 4 | `modules/dashboard/dashboard.supervisor.snapshot-products.ts` | 291 | Products snapshot | 🔴 |
| 5 | `modules/dashboard/sales-monitoring.snapshot.breakdown.ts` | 245 | Breakdown analysis | 🔴 |
| 6 | `modules/dashboard/sales-monitoring.scope.ts` | 245 | Sales scope | 🟡 |
| 7 | `modules/dashboard/sales-monitoring.snapshot.base.ts` | 233 | **7 parallel queries** | 🔴 |

**Asosiy muammolar:**
- `dashboard.finance.snapshot.ts` - 366 lines, 14 separate $queryRaw, 5 JS reduce loops
- `sales-monitoring.snapshot.base.ts` - 233 lines, 7 independent queries (7x DB round-trip)
- Multiple JS reduce loops instead of SQL SUM

---

### Stock Module (77 fayl, ~9516 qator)

| # | Fayl | Qator | Muammo | Priority |
|---|------|-------|--------|----------|
| 1 | `modules/stock/stock.balances.ts` | 304 | Stock balances | 🟡 |
| 2 | `modules/stock/stock.recommended.ts` | 302 | Stock recommendations | 🟢 |
| 3 | `modules/stock/goods-receipt.route.ts` | 299 | Receipt routes | 🟡 |
| 4 | `modules/stock/warehouse-transfers.lifecycle.ts` | 280 | **Transfer transaction** | 🔴 |
| 5 | `modules/stock/warehouse-blocks.service.ts` | 274 | Warehouse blocks | 🟡 |
| 6 | `modules/stock/stock.balances.helpers.ts` | 264 | Balance helpers | 🟢 |
| 7 | `modules/stock/suppliers.route.write.ts` | 263 | Supplier write | 🟡 |
| 8 | `modules/stock/stock.material-report.list.ts` | 262 | Material report | 🟢 |
| 9 | `modules/stock/stock.by-date.ts` | 255 | Stock by date | 🟢 |
| 10 | `modules/stock/stock.import.helpers.ts` | 242 | Import helpers | 🟡 |

**Asosiy muammolar:**
- `warehouse-transfers.lifecycle.ts` - 280 lines, incomplete transaction wrapping
- Multiple $transaction calls that should be one

---

### Payments Module (20 fayl, ~2562 qator)

| # | Fayl | Qator | Muammo | Priority |
|---|------|-------|--------|----------|
| 1 | `modules/payments/payment.balance.ts` | 340 | **CRITICAL - transaction bug** | 🔴🔴 |
| 2 | `modules/payments/payment.query.mappers.ts` | 317 | Query mappers | 🟡 |
| 3 | `modules/payments/payment.create.ts` | 269 | Payment creation | 🟡 |
| 4 | `modules/payments/payments.route.write.ts` | 260 | Write routes | 🟡 |
| 5 | `modules/payments/payment.query.update.ts` | 210 | Query update | 🟡 |
| 6 | `modules/payments/payment.query.read.ts` | 187 | Query read | 🟡 |
| 7 | `modules/payments/payments.route.read.ts` | 178 | Read routes | 🟡 |
| 8 | `modules/payments/payment-allocations.open.ts` | 170 | FIFO open | 🟡 |
| 9 | `modules/payments/payment-allocations.allocate.ts` | 155 | **FIFO N+1 pattern** | 🔴 |

**Asosiy muammolar:**
- `payment.balance.ts:245` - transaction tashqarisida allocation
- `payment-allocations.allocate.ts` - sequential query for each order

---

### Staff Module (~6673 qator)

| # | Fayl | Qator | Muammo | Priority |
|---|------|-------|--------|----------|
| 1 | `modules/staff/staff.route.operators.ts` | 362 | Operators routes | 🟡 |
| 2 | `modules/staff/staff.patches.web-agents-roles.ts` | 349 | Agent role patches | 🟢 |
| 3 | `modules/staff/staff.shared.helpers.ts` | 328 | Shared helpers | 🟡 |
| 4 | `modules/staff/staff.patches.web-agents-bulk.ts` | 314 | Bulk patches | 🟡 |
| 5 | `modules/staff/staff.crud.list.ts` | 297 | CRUD list | 🟡 |
| 6 | `modules/staff/agent-mobile-config.parse.ts` | 286 | Mobile config | 🟢 |
| 7 | `modules/staff/staff.route.skladchik.ts` | 274 | Skladchik routes | 🟡 |

---

### Reports Module (28 fayl, ~9483 qator)

| # | Fayl | Qator | Muammo | Priority |
|---|------|-------|--------|----------|
| 1 | `modules/reports/reports.route.specialized.ts` | 368 | Specialized reports | 🟡 |
| 2 | `modules/reports/visit-totals.helpers.ts` | 351 | Visit totals | 🟡 |
| 3 | `modules/reports/order-debts.query.ts` | 326 | Order debts query | 🟡 |
| 4 | `modules/reports/agent-orders.report.ts` | 319 | Agent orders report | 🟡 |
| 5 | `modules/reports/agent-orders.helpers.ts` | 276 | Agent orders helpers | 🟢 |
| 6 | `modules/reports/client-sales-2.report.ts` | 275 | Client sales v2 | 🟡 |
| 7 | `modules/reports/expeditor-returns.aggregates.ts` | 250 | Expeditor aggregates | 🟡 |
| 8 | `modules/reports/order-debts.list.ts` | 244 | Order debts list | 🟡 |

**Asosiy muammolar:**
- `client-sales-4.report.ts` - duplicate CTE
- Multiple JS reduce loops in reports

---

### Products Module (~3955 qator)

| # | Fayl | Qator | Muammo | Priority |
|---|------|-------|--------|----------|
| 1 | `modules/products/products.import.update.ts` | 355 | Import update | 🟡 |
| 2 | `modules/products/price-matrix.service.ts` | 335 | Price matrix | 🟡 |
| 3 | `modules/products/product-prices.service.ts` | 328 | Product prices | 🟡 |
| 4 | `modules/products/product-catalog.route.ts` | 308 | Catalog route | 🟡 |
| 5 | `modules/products/products.import.catalog.ts` | 289 | Import catalog | 🟡 |

---

### Access Module (~4130 qator)

| # | Fayl | Qator | Muammo | Priority |
|---|------|-------|--------|----------|
| 1 | `modules/access/legacy-permissions.generated.ts` | 345 | Legacy permissions | 🟢 |
| 2 | `modules/access/access.route.dimensions-users.ts` | 334 | Dimensions users | 🟡 |
| 3 | `modules/access/access.route.users-write.ts` | 288 | Users write | 🟡 |
| 4 | `modules/access/access.route.users-bulk.ts` | 269 | Bulk users | 🟡 |
| 5 | `modules/access/access-territories-sync.ts` | 254 | Territory sync | 🟡 |
| 6 | `modules/access/rbac.permissions.ts` | 178 | **RBAC Promise bug** | 🔴🔴 |

**Asosiy muammo:**
- `rbac.permissions.ts:39-48` - Promise not awaited

---

### Returns Module (~3074 qator)

| # | Fayl | Qator | Muammo | Priority |
|---|------|-------|--------|----------|
| 1 | `modules/returns/returns-enhanced.create-period.ts` | 359 | Create period | 🟡 |
| 2 | `modules/returns/returns-enhanced.client-data.ts` | 349 | Client data N+1 | 🔴 |
| 3 | `modules/returns/sales-returns.service.ts` | 336 | Returns service | 🟡 |
| 4 | `modules/returns/returns-enhanced.create-batch.prepare.ts` | 315 | Batch prepare | 🟡 |
| 5 | `modules/returns/sales-returns.route.write.ts` | 303 | Write routes | 🟡 |
| 6 | `modules/returns/returns-enhanced.compute.ts` | 271 | Compute | 🟡 |
| 7 | `modules/returns/sales-returns.route.read.ts` | 241 | Read routes | 🟡 |

**Asosiy muammo:**
- `returns-enhanced.client-data.ts` - 10+ sequential findMany in loop

---

## Frontend Fayllar (>400 qator)

### Access Control (2 fayl, ~5391 qator)

| # | Fayl | Qator | Muammo | Priority |
|---|------|-------|--------|----------|
| 1 | `components/access/access-workspace.tsx` | 2870 | **Eng katta - permission matrix** | 🔴 |
| 2 | `components/access/access-user-detail-panel.tsx` | 2521 | User detail panel | 🔴 |

---

### Dashboard (5 fayl, ~9864 qator)

| # | Fayl | Qator | Muammo | Priority |
|---|------|-------|--------|----------|
| 1 | `components/dashboard/dashboard-sales-monitoring.tsx` | 2642 | Sales monitoring | 🔴 |
| 2 | `components/dashboard/dashboard-home.tsx` | 1829 | Home dashboard | 🟡 |
| 3 | `components/dashboard/dashboard-sales.tsx` | 1708 | Sales dashboard | 🟡 |
| 4 | `components/dashboard/dashboard-finance.tsx` | 1458 | Finance dashboard | 🟡 |
| 5 | `components/dashboard/app-shell.tsx` | 1207 | App shell | 🟢 |

---

### Orders (4 fayl, ~6615 qator)

| # | Fayl | Qator | Muammo | Priority |
|---|------|-------|--------|----------|
| 1 | `components/orders/order-create/view/order-create-view.tsx` | 2100 | Order create view | 🔴 |
| 2 | `components/orders/order-create/hooks/use-order-create.ts` | 2161 | **50+ useMemo** | 🔴 |
| 3 | `app/(dashboard)/orders/page.tsx` | 2066 | Orders list | 🟡 |
| 4 | `components/orders/order-detail-view.tsx` | 1249 | Order detail | 🟡 |

---

### Staff (8 fayl, ~11170 qator)

| # | Fayl | Qator | Muammo | Priority |
|---|------|-------|--------|----------|
| 1 | `components/staff/agents-workspace.tsx` | 2452 | Agents workspace | 🔴 |
| 2 | `components/staff/skladchik-workspace.tsx` | 1876 | Skladchik | 🟡 |
| 3 | `components/staff/expeditors-workspace.tsx` | 1690 | Expeditors | 🟡 |
| 4 | `components/staff/operators-workspace.tsx` | 1175 | Operators | 🟡 |
| 5 | `components/staff/consignment-workspace.tsx` | 846 | Consignment | 🟢 |
| 6 | `components/staff/supervisors-workspace.tsx` | 923 | Supervisors | 🟢 |
| 7 | `components/staff/auditors-workspace.tsx` | 559 | Auditors | 🟢 |
| 8 | `components/staff/collectors-workspace.tsx` | 509 | Collectors | 🟢 |

---

### Clients (8 fayl, ~10389 qator)

| # | Fayl | Qator | Muammo | Priority |
|---|------|-------|--------|----------|
| 1 | `components/clients/client-edit-form.tsx` | 1833 | Client edit form | 🟡 |
| 2 | `components/clients/client-profile-hub.tsx` | 1336 | Profile hub | 🟡 |
| 3 | `components/clients/client-detail-view.tsx` | 1213 | Client detail | 🟡 |
| 4 | `components/clients/client-balance-ledger-view.tsx` | 1217 | Balance ledger | 🟡 |
| 5 | `components/clients/client-merge-workspace.tsx` | 1365 | Client merge | 🟡 |
| 6 | `components/clients/client-merge-compare-overlay.tsx` | 694 | Merge compare | 🟢 |
| 7 | `components/clients/clients-data-table.tsx` | 471 | Data table | 🟢 |
| 8 | `components/clients/client-import-mapping-dialog.tsx` | 453 | Import mapping | 🟢 |

---

### Client Balances (3 fayl, ~4019 qator)

| # | Fayl | Qator | Muammo | Priority |
|---|------|-------|--------|----------|
| 1 | `components/client-balances/client-balances-workspace.tsx` | 2206 | Balances workspace | 🔴 |
| 2 | `components/client-balances/consignment-balances-workspace.tsx` | 1371 | Consignment balances | 🟡 |
| 3 | `components/client-balances/client-balances-bulk-payment-dialog.tsx` | 442 | Bulk payment | 🟢 |

---

### Reports (7 fayl, ~7918 qator)

| # | Fayl | Qator | Muammo | Priority |
|---|------|-------|--------|----------|
| 1 | `components/reports/wdr-report-builder.tsx` | 2698 | **WebDataRocks pivot** | 🔴 |
| 2 | `components/reports/order-debts-workspace.tsx` | 1483 | Order debts | 🟡 |
| 3 | `components/reports/cash-flow-workspace.tsx` | 889 | Cash flow | 🟢 |
| 4 | `components/reports/report-builder-workspace.tsx` | 705 | Report builder | 🟢 |
| 5 | `components/reports/income-report-workspace.tsx` | 640 | Income report | 🟢 |
| 6 | `components/reports/client-reconciliation-workspace.tsx` | 604 | Reconciliation | 🟢 |
| 7 | `components/reports/expeditor-returns-workspace.tsx` | 599 | Expeditor returns | 🟢 |

---

### Payments (4 fayl, ~4258 qator)

| # | Fayl | Qator | Muammo | Priority |
|---|------|-------|--------|----------|
| 1 | `components/payments/client-payments-workspace.tsx` | 1640 | Payments workspace | 🟡 |
| 2 | `components/payments/add-payment-form.tsx` | 790 | Add payment | 🟢 |
| 3 | `components/payments/edit-payment-dialog.tsx` | 529 | Edit payment | 🟢 |
| 4 | `components/payments/expeditor-payment-requests-workspace.tsx` | 1299 | Payment requests | 🟡 |

---

### Stock (10 fayl, ~7870 qator)

| # | Fayl | Qator | Muammo | Priority |
|---|------|-------|--------|----------|
| 1 | `components/stock/stock-balances-workspace.tsx` | 1234 | Stock balances | 🟡 |
| 2 | `components/stock/goods-receipt-new-workspace.tsx` | 996 | Goods receipt | 🟡 |
| 3 | `components/stock/goods-receipts-workspace.tsx` | 884 | Receipts list | 🟢 |
| 4 | `components/stock/transfer-amaliyot-workspace.tsx` | 881 | Transfer workspace | 🟡 |
| 5 | `components/stock/warehouse-blocks-workspace.tsx` | 845 | Warehouse blocks | 🟢 |
| 6 | `components/stock/stock-receipts-report-workspace.tsx` | 762 | Receipt report | 🟢 |
| 7 | `components/stock/stock-recommended-workspace.tsx` | 629 | Recommended stock | 🟢 |
| 8 | `components/stock/material-report-workspace.tsx` | 518 | Material report | 🟢 |
| 9 | `components/stock/inventory-take-editor.tsx` | 538 | Inventory take | 🟢 |
| 10 | `components/stock/stock-by-date-workspace.tsx` | 419 | Stock by date | 🟢 |

---

### Products (4 fayl, ~3392 qator)

| # | Fayl | Qator | Muammo | Priority |
|---|------|-------|--------|----------|
| 1 | `components/products/products-catalog-workspace.tsx` | 1282 | Catalog workspace | 🟡 |
| 2 | `components/products/product-form.tsx` | 1057 | Product form | 🟡 |
| 3 | `components/products/product-bulk-add-panel.tsx` | 574 | Bulk add | 🟢 |
| 4 | `components/products/product-quick-add-dialog.tsx` | 479 | Quick add | 🟢 |

---

### Bonus Rules (4 fayl, ~3218 qator)

| # | Fayl | Qator | Muammo | Priority |
|---|------|-------|--------|----------|
| 1 | `components/bonus-rules/bonus-rule-form.tsx` | 1353 | Bonus rule form | 🟡 |
| 2 | `components/bonus-rules/bonus-rules-list-view.tsx` | 846 | Rules list | 🟢 |
| 3 | `components/bonus-rules/bonus-rule-order-scope-dialog.tsx` | 618 | Order scope | 🟢 |
| 4 | `components/bonus-rules/bonus-rule-product-category-tree.tsx` | 501 | Category tree | 🟢 |

---

### Pages (11 fayl, ~10112 qator)

| # | Fayl | Qator | Muammo | Priority |
|---|------|-------|--------|----------|
| 1 | `app/(dashboard)/returns/page.tsx` | 1334 | Returns page | 🟡 |
| 2 | `app/(dashboard)/clients/page.tsx` | 1300 | Clients list | 🟡 |
| 3 | `app/(dashboard)/stock/correction/page.tsx` | 1297 | Stock correction | 🟡 |
| 4 | `app/(dashboard)/reports/expeditor-returns/page.tsx` | 1087 | Expeditor returns | 🟡 |
| 5 | `app/(dashboard)/stock/transfers/page.tsx` | 1079 | Stock transfers | 🟡 |
| 6 | `app/(dashboard)/reports/product-sales/page.tsx` | 933 | Product sales | 🟢 |
| 7 | `app/(dashboard)/settings/branches/page.tsx` | 829 | Branches settings | 🟢 |
| 8 | `app/(dashboard)/reports/client-sales-2/page.tsx` | 806 | Client sales v2 | 🟢 |
| 9 | `app/(dashboard)/reports/visits-2/page.tsx` | 553 | Visits v2 | 🟢 |
| 10 | `app/(dashboard)/reports/visit-totals/page.tsx` | 499 | Visit totals | 🟢 |
| 11 | `app/(dashboard)/stock/page.tsx` | 633 | Stock overview | 🟢 |

---

### UI Components (4 fayl, ~2156 qator)

| # | Fayl | Qator | Muammo | Priority |
|---|------|-------|--------|----------|
| 1 | `components/ui/date-range-popover.tsx` | 671 | Date range picker | 🟢 |
| 2 | `components/ui/datetime-popover.tsx` | 556 | Date time picker | 🟢 |
| 3 | `components/ui/month-year-picker-popover.tsx` | 483 | Month year picker | 🟢 |
| 4 | `components/ui/searchable-multi-select-panel.tsx` | 446 | Multi-select | 🟢 |

---

### Other (16 fayl, ~12000+ qator)

| # | Fayl | Qator | Module | Priority |
|---|------|-------|--------|----------|
| 1 | `components/suppliers/suppliers-workspace.tsx` | 768 | Suppliers | 🟢 |
| 2 | `components/suppliers/suppliers-payments-workspace.tsx` | 880 | Supplier payments | 🟡 |
| 3 | `components/suppliers/suppliers-balances-workspace.tsx` | 484 | Supplier balances | 🟢 |
| 4 | `components/suppliers/suppliers-reconciliation-workspace.tsx` | 591 | Supplier reconciliation | 🟢 |
| 5 | `components/warehouses/warehouses-workspace.tsx` | 1048 | Warehouses | 🟡 |
| 6 | `components/cash-desks/cash-desks-workspace.tsx` | 1124 | Cash desks | 🟡 |
| 7 | `components/work-slots/work-slots-workspace.tsx` | 706 | Work slots | 🟢 |
| 8 | `components/work-slots/work-slots-bulk-dialog.tsx` | 428 | Bulk dialog | 🟢 |
| 9 | `components/work-slots/work-slots-location-fields.tsx` | 406 | Location fields | 🟢 |
| 10 | `components/opening-balances/initial-balances-workspace.tsx` | 684 | Initial balances | 🟢 |
| 11 | `components/opening-balances/add-opening-balance-dialog.tsx` | 430 | Add balance | 🟢 |
| 12 | `components/currency-rates/currency-rates-workspace.tsx` | 683 | Currency rates | 🟢 |
| 13 | `components/client-expenses/add-client-expense-dialog.tsx` | 636 | Client expenses | 🟢 |
| 14 | `components/access/access-history-workspace.tsx` | 851 | Access history | 🟢 |
| 15 | `components/access/access-role-defaults-workspace.tsx` | 564 | Role defaults | 🟢 |
| 16 | `components/clients/client-qr-workspace.tsx` | 1110 | Client QR | 🟡 |

---

## Xulosa: Priority Bo'yicha Ro'yxat

### O'ta muhim (Darhol tuzatish) - 🔴🔴

| # | Fayl | Qator | Muammo |
|---|------|-------|--------|
| 1 | `modules/payments/payment.balance.ts` | 340 | Transaction bug |
| 2 | `modules/access/rbac.permissions.ts` | 178 | Promise not awaited |
| 3 | `modules/stock/warehouse-transfers.lifecycle.ts` | 280 | Incomplete transaction |
| 4 | `modules/dashboard/dashboard.finance.snapshot.ts` | 366 | 14 queries + JS reduce |

### Muhim (Tezkor tuzatish) - 🔴

| # | Fayl | Qator | Muammo |
|---|------|-------|--------|
| 5 | `modules/clients/clients.detail.ts` | 329 | N+1 pattern |
| 6 | `modules/clients/clients.list.ts` | 346 | Sequential audit writes |
| 7 | `modules/payments/payment-allocations.allocate.ts` | 155 | FIFO N+1 |
| 8 | `modules/orders/domain/order.query.ts` | 337 | Murakkab query |
| 9 | `modules/returns/returns-enhanced.client-data.ts` | 349 | N+1 pattern |
| 10 | `modules/clients/clients.import.main.ts` | 364 | Katta import |
| 11 | `sales-monitoring.snapshot.base.ts` | 233 | 7 parallel queries |
| 12 | `sales-monitoring.snapshot.breakdown.ts` | 245 | Multiple reduces |

### O'rta (Keyinroq) - 🟡

| # | Fayl | Qator | Muammo |
|---|------|-------|--------|
| 13 | `components/access/access-workspace.tsx` | 2870 | Katta component |
| 14 | `components/orders/order-create/hooks/use-order-create.ts` | 2161 | 50+ useMemo |
| 15 | `components/dashboard/dashboard-sales-monitoring.tsx` | 2642 | Real-time charts |
| 16 | `components/reports/wdr-report-builder.tsx` | 2698 | Pivot table |
| 17 | `components/staff/agents-workspace.tsx` | 2452 | Complex UI |
| 18 | `components/client-balances/client-balances-workspace.tsx` | 2206 | Balance views |

---

## Statistika

| Kategoriya | Fayllar soni | Jami qatorlar |
|------------|-------------|---------------|
| Backend katta fayllar (>400) | ~80 | ~45,000 |
| Frontend katta fayllar (>400) | ~100 | ~85,000 |
| **Jami** | **~180** | **~130,000** |

---

**Hujjat yaratildi:** 2026-yil 18-may  
**Version:** 1.0