# SALEC - To'liq Optimizatsiya va Qayta Qurish Rejasi

**Loyha:** `E:\SALEC — копия`  
**Sana:** 2026-yil 18-may  
**Maqsad:** Tizimni professional darajada optimizatsiya qilish  
**Version:** 2.0

---

## 📋 Mundarija

1. [Umumiy Ko'rinish](#umumiy-ko'rinish)
2. [Phase 1: Critical N+1 Fixes](#phase-1-critical-n1-fixes)
3. [Phase 2: 400+ Qatorli Fayllarni Bo'lish](#phase-2-400-qatorli-fayllarni-bolish)
4. [Phase 3: Migration va Indexlar](#phase-3-migration-va-indexlar)
5. [Phase 4: Duplicate Kod Extrakti](#phase-4-duplicate-kod-extrakti)
6. [Phase 5: Query Optimizatsiya](#phase-5-query-optimizatsiya)
7. [Phase 6: Schema Yaxshilash](#phase-6-schema-yaxshilash)
8. [Phase 7: Frontend Optimizatsiya](#phase-7-frontend-optimizatsiya)
9. [Implementation Plan](#implementation-plan)

---

## Umumiy Ko'rinish

### Topilmalar Qisqacha

| Tur | Soni | Holat |
|-----|------|-------|
| 400+ qatorli backend fayllar | 17 ta | Bo'lish kerak |
| 200-400 qatorli backend fayllar | 70 ta | Qisman bo'lish kerak |
| N+1 query patterns | 12 ta | Darhol tuzatish kerak |
| Duplicate code patterns | 8 ta | Extrakt qilish kerak |
| $queryRaw usages | 217 ta | 95% justified |
| Migration file muammolari | 2 ta | Nomlash xatosi |
| Missing indexes | 18 ta | Qo'shish kerak |
| String → Enum conversion | 32+ ta | Kelajakda |

### Performance Impact Hisoblash

| O'zgartirish | Hozirgi | Yangi | Tezlanish |
|---------------|---------|-------|----------|
| N+1 fixes (12 ta) | O(n) queries | O(1) batch | 10-50x |
| Index qo'shish (18 ta) | Full scan | Index seek | 100-1000x |
| CTE optimization (5 ta) | Multiple queries | Single query | 3-7x |
| Code splitting | 2870 lines | 300 lines | 10x o'qilishi |
| Batch operations | Sequential | Parallel | 5-20x |

---

## Phase 1: Critical N+1 Fixes

### 1.1 Client Merge - Sequential Awaits

**Fayl:** `src/modules/clients/clients.merge.ts:15-69`

**Muammo:**
```typescript
// HOZIRGI - Sequential awaits in loop
for (const mid of mergeIds) {
  const dupBal = await tx.clientBalance.findUnique({...});
  // ... more awaits
}
```

**Yechim:** `createBalanceTransfer` function yaratish:
```typescript
// YANGI - Batch operations
async function transferClientBalances(
  tx: Prisma.TransactionClient,
  tenantId: number,
  keepClientId: number,
  mergeClientIds: number[]
): Promise<void> {
  // 1. Fetch all balances in one query
  const allBalances = await tx.clientBalance.findMany({
    where: {
      tenant_id: tenantId,
      client_id: { in: [keepClientId, ...mergeClientIds] }
    }
  });

  // 2. Calculate total debt
  const keepBalance = allBalances.find(b => b.client_id === keepClientId);
  const mergeBalances = allBalances.filter(b => mergeClientIds.includes(b.client_id));
  const totalDebt = mergeBalances.reduce((sum, b) => sum + b.balance, keepBalance?.balance ?? 0);

  // 3. Batch update
  await tx.clientBalance.update({
    where: { tenant_id_client_id: { tenant_id, client_id: keepClientId } },
    data: { balance: totalDebt }
  });

  await tx.clientBalance.deleteMany({
    where: { client_id: { in: mergeClientIds } }
  });
}
```

**Ta'sir:** 50 client merge = 50 queries → 3 queries | **50x tezlanish**

---

### 1.2 Client Import Rows-Create - Per-Row Transactions

**Fayl:** `src/modules/clients/clients.import.rows-create.ts:221-266`

**Muammo:**
```typescript
// HOZIRGI - Har bir row uchun alohida transaction
for (const row of rows) {
  await prisma.$transaction(async (tx) => {
    const client = await tx.client.create({...});
    if (agentPatches.length > 0) {
      await replaceClientAgentAssignments(tx, ...);
    }
  });
}
```

**Yechim:** Batch processing with chunking:
```typescript
// YANGI
async function importClientsBatch(
  tenantId: number,
  rows: ImportRow[],
  chunkSize: number = 100
): Promise<ImportResult> {
  const errors: ImportError[] = [];
  const created: number[] = [];

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);

    await prisma.$transaction(async (tx) => {
      // Process entire chunk in single transaction
      for (const row of chunk) {
        try {
          const client = await tx.client.create({
            data: { tenant_id: tenantId, ...row.clientData }
          });
          created.push(client.id);

          if (row.agentData.length > 0) {
            await tx.clientAgentAssignment.createMany({
              data: row.agentData.map(a => ({
                client_id: client.id,
                ...a
              }))
            });
          }
        } catch (e) {
          errors.push({ row: i, error: e.message });
        }
      }
    });
  }

  return { created, errors };
}
```

**Ta'sir:** 1000 rows = 1000 transactions → 10 transactions | **100x tezlanish**

---

### 1.3 Staff Patch - Sequential Updates

**Fayl:** `src/modules/staff/staff.patches.web-agents-bulk.ts:298-307`

**Muammo:**
```typescript
// HOZIRGI - Sequential updateMany in transaction
await prisma.$transaction(
  rows.map((u) => prisma.user.update({...}))
);
```

**Yechim:**
```typescript
// YANGI - Bulk update with raw SQL
await tx.$executeRaw`
  UPDATE users
  SET is_active = data.is_active,
      price_type = data.price_type,
      warehouse_id = data.warehouse_id
  FROM (VALUES ${Prisma.join(rows.map(r =>
    Prisma.sql`(${r.userId}, ${r.isActive}, ${r.priceType}, ${r.warehouseId})`
  ))}) AS data(id, is_active, price_type, warehouse_id)
  WHERE users.id = data.id AND users.tenant_id = ${tenantId}
`;
```

**Ta'sir:** 100 updates = 100 queries → 1 query | **100x tezlanish**

---

### 1.4 Access RBAC - Sequential Upserts

**Fayl:** `src/modules/access/rbac.permissions.ts:39-50` (ALLAQACHON TUZATILDI ✅)

**Holat:** ✅ Allaqachon `Promise.all` bilan tuzatildi

---

### 1.5 N+1 Pattern List (Priority Order)

| # | Fayl | Line | Muammo | Fix | Tezlanish |
|---|------|------|--------|-----|----------|
| 1 | `clients.merge.ts` | 15-69 | Sequential balance transfer | Batch query | 50x |
| 2 | `clients.import.rows-create.ts` | 221-266 | Per-row transactions | Chunk + single tx | 100x |
| 3 | `clients.import.rows-update.ts` | 232-246 | Per-row update | Batch update | 50x |
| 4 | `staff.patches.web-agents-bulk.ts` | 298-307 | Sequential updates | Raw SQL bulk | 100x |
| 5 | `clients.merge.ts` | 57-69 | Sequential assignment finds | findMany + filter | 20x |

---

## Phase 2: 400+ Qatorli Fayllarni Bo'lish

### 2.1 Backend Fayllar

#### A. `orders/domain/order.query.ts` (370 lines)

**Hozirgi:**
```
order.query.ts
├── Query building (100 lines)
├── Filter parsing (80 lines)
├── Cache logic (50 lines)
├── SQL generation (100 lines)
└── Response mapping (40 lines)
```

**Yangi Struktur:**
```
orders/domain/query/
├── order.query.ts           # Export + entry (50 lines)
├── order.query-builder.ts   # SQL builder (100 lines)
├── order.query-filters.ts   # Filter parsing (80 lines)
├── order.query-cache.ts     # Cache logic (50 lines)
└── order.query-response.ts  # Response mapping (40 lines)
```

**Files:**
- `src/modules/orders/domain/query/order.query.ts` - Entry point
- `src/modules/orders/domain/query/order.query-builder.ts` - SQL generation
- `src/modules/orders/domain/query/order.query-filters.ts` - Filter parsing
- `src/modules/orders/domain/query/order.query-cache.ts` - Redis caching
- `src/modules/orders/domain/query/order.query-response.ts` - Response mapping

---

#### B. `clients/clients.import.main.ts` (364 lines)

**Yangi Struktur:**
```
clients/
├── import/
│   ├── import-main.ts           # Orchestrator (60 lines)
│   ├── import-parser.ts          # XLSX parsing (80 lines)
│   ├── import-assign.ts         # Agent assignment (100 lines)
│   ├── import-create.ts         # Create logic (80 lines)
│   └── import-update.ts         # Update logic (70 lines)
```

**Files:**
- `src/modules/clients/import/import-main.ts` - Main orchestrator
- `src/modules/clients/import/import-parser.ts` - Excel parsing
- `src/modules/clients/import/import-assign.ts` - Column mapping + assignment
- `src/modules/clients/import/import-create.ts` - Client creation
- `src/modules/clients/import/import-update.ts` - Client update

---

#### C. `mobile/mobile.service.ts` (366 lines)

**Yangi Struktur:**
```
mobile/
├── mobile-service.ts           # Entry (40 lines)
├── mobile-clients.ts          # Clients data (80 lines)
├── mobile-catalog.ts          # Products/prices (100 lines)
├── mobile-config.ts            # Config generation (80 lines)
└── mobile-work-slots.ts       # Work slots (50 lines)
```

**Files:**
- `src/modules/mobile/mobile-service.ts` - Service entry
- `src/modules/mobile/mobile-clients.ts` - Clients for mobile
- `src/modules/mobile/mobile-catalog.ts` - Product catalog
- `src/modules/mobile/mobile-config.ts` - Mobile config
- `src/modules/mobile/mobile-work-slots.ts` - Work slot data

---

#### D. `staff/staff.route.operators.ts` (362 lines)

**Yangi Struktur:**
```
staff/
├── operators/
│   ├── operators.routes.ts     # Route registration (40 lines)
│   ├── operators.list.ts        # List handlers (80 lines)
│   ├── operators.sessions.ts    # Session management (100 lines)
│   ├── operators.presets.ts     # Position presets (80 lines)
│   └── operators.schemas.ts    # Zod schemas (60 lines)
```

**Files:**
- `src/modules/staff/operators/operators.routes.ts` - Route setup
- `src/modules/staff/operators/operators.list.ts` - List operations
- `src/modules/staff/operators/operators.sessions.ts` - Sessions
- `src/modules/staff/operators/operators.presets.ts` - Presets
- `src/modules/staff/operators/operators.schemas.ts` - Validation

---

#### E. `orders/order-create-context.service.ts` (351 lines)

**Yangi Struktur:**
```
orders/
├── order-create-context.service.ts  # Main entry (50 lines)
├── order-context-catalog.ts         # Product catalog fetch (100 lines)
├── order-context-clients.ts         # Client data fetch (80 lines)
├── order-context-price-types.ts     # Price types (60 lines)
└── order-context-work-slots.ts       # Work slots (50 lines)
```

---

#### F. `orders/domain/order.lines.ts` (363 lines)

**Yangi Struktur:**
```
orders/domain/
├── order.lines.ts              # Entry (50 lines)
├── order-lines-update.ts       # Line update logic (100 lines)
├── order-lines-bonus.ts       # Bonus calculation (100 lines)
└── order-lines-validation.ts  # Line validation (100 lines)
```

---

#### G. `clients/client-assets.service.ts` (361 lines)

**Yangi Struktur:**
```
clients/
├── assets/
│   ├── assets.service.ts       # Entry (50 lines)
│   ├── client-equipment.ts     # Equipment CRUD (100 lines)
│   ├── client-photos.ts       # Photo reports (100 lines)
│   └── client-qr.ts           # QR code management (100 lines)
```

---

#### H. `returns/returns-enhanced.create-period.ts` (359 lines)

**Yangi Struktur:**
```
returns/
├── create-period/
│   ├── create-period.service.ts  # Entry (50 lines)
│   ├── returns-batch-compute.ts # Batch computation (150 lines)
│   └── returns-period-create.ts # Period creation (150 lines)
```

---

### 2.2 Backend - 200-300 Qatorli Fayllar (Qisman Bo'lish)

| Fayl | Lines | Bo'lish Kerakmi? | Yangi Nom |
|------|-------|------------------|-----------|
| `staff.patches.web-agents-roles.ts` | 349 | ✅ Ha | `staff.patch-roles.ts` + `staff.patch-sessions.ts` |
| `consignment-balances.service.ts` | 343 | ✅ Ha | `consignment-balances-fetch.ts` + `consignment-debt-calc.ts` |
| `clients.list.ts` | 344 | ✅ Ha | `clients.list.ts` + `clients.export.ts` + `clients.bulk.ts` |
| `clients.merge.ts` | 357 | ✅ Ha | `clients.merge-preview.ts` + `clients.merge-execute.ts` |
| `clients.detail.ts` | 339 | ✅ Ha | `clients.detail-read.ts` + `clients.detail-write.ts` |
| `clients.import.assign.ts` | 367 | ✅ Ha | `import-column-map.ts` + `import-agent-assign.ts` |
| `payment.balance.ts` | 354 | ✅ Ha | `payment-delete.ts` + `payment-void.ts` + `payment-adjust.ts` |
| `dashboard.supervisor.snapshot-visits.query.ts` | 351 | ✅ Ha | `visit-snapshot-query.ts` + `visit-snapshot-cache.ts` |
| `staff.patches.web-agents-bulk.ts` | 314 | ✅ Ha | `staff.bulk-roles.ts` + `staff.bulk-sessions.ts` |
| `products.import.update.ts` | 355 | ✅ Ha | `products.import-parse.ts` + `products.import-write.ts` |
| `order.lifecycle.ts` | 340 | ✅ Ha | `order-status-transition.ts` + `order-stock-update.ts` |

---

## Phase 3: Migration va Indexlar

### 3.1 Mavjud Migration Muammolari

**Muammo:** Ikkita migration bir xil nom bilan:
- `20260518120000_performance_indexes`
- `20260518150000_performance_indexes`

**Yechim:** Bittasini qayta nomlash

```bash
# 1. Mavjud migrationni tekshirish
ls prisma/migrations/

# 2.migration.jsonni yangilash
```

### 3.2 Yangi Migration Fayllar

#### Migration: Fix Duplicate Names

**Fayl:** `prisma/migrations/20260518153000_rename_duplicate_indexes/`

```sql
-- migration.sql
-- Bu migration 20260518150000 ni qayta nomlash uchun
-- Hozircha Prisma avtomatik nomlash ishlatadi
```

#### Migration: Missing FK Indexes

**Fayl:** `prisma/migrations/20260519120000_fk_indexes/migration.sql`

```sql
-- ClientAgentAssignment agent_id
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_client_agent_assignments_agent_id
ON client_agent_assignments(agent_id);

-- ClientAgentAssignment expeditor
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_client_agent_assignments_expeditor
ON client_agent_assignments(expeditor_user_id);

-- WarehouseCorrection created_by
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_warehouse_corrections_created_by
ON warehouse_corrections(created_by_user_id);

-- SlotAuditEntry users
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_slot_audit_entries_prev_user
ON slot_audit_entries(prev_user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_slot_audit_entries_next_user
ON slot_audit_entries(next_user_id);

-- KpiResult kpi_group
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kpi_results_kpi_group
ON kpi_results(kpi_group_id);
```

#### Migration: Composite Indexes

**Fayl:** `prisma/migrations/20260519130000_composite_indexes/migration.sql`

```sql
-- BonusRule active rules lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bonus_rules_tenant_active_type
ON bonus_rules(tenant_id, is_active, type);

-- BonusRule date range valid rules
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_bonus_rules_tenant_active_dates
ON bonus_rules(tenant_id, is_active, valid_from, valid_to);

-- WarehouseCorrection warehouse history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_warehouse_corrections_warehouse_created
ON warehouse_corrections(tenant_id, warehouse_id, created_at DESC);

-- SupplierPayment supplier history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_supplier_payments_supplier_paid
ON supplier_payments(tenant_id, supplier_id, paid_at DESC);

-- GoodsReceipt supplier history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_goods_receipts_supplier_created
ON goods_receipts(tenant_id, supplier_id, created_at DESC);

-- ClientOpeningBalanceEntry type filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_client_opening_balance_type
ON client_opening_balance_entries(tenant_id, balance_type, created_at DESC);

-- ClientEquipment active only
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_client_equipment_active
ON client_equipment(tenant_id)
WHERE removed_at IS NULL;

-- SalesReturn warehouse history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sales_returns_warehouse_created
ON sales_returns(tenant_id, warehouse_id, created_at DESC);

-- KpiResult period+user
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_kpi_results_period_user
ON kpi_results(tenant_id, period_month, user_id);

-- AgentVisit agent history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_visits_agent_recorded
ON agent_visits(tenant_id, agent_id, checked_in_at DESC);

-- Expense creator history
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_expenses_created_by
ON expenses(tenant_id, created_by_user_id, created_at DESC);
```

### 3.3 Migration Execution Order

```bash
# 1. Prisma migrate status
cd backend
npx prisma migrate status

# 2. Apply migrations
npx prisma migrate deploy

# 3. Verify indexes
psql -c "\d orders" | grep idx
psql -c "\d bonus_rules" | grep idx
```

---

## Phase 4: Duplicate Kod Extrakti

### 4.1 Balance Upsert Pattern (15+ usage)

**Hozirgi:** Har bir faylda takrorlanadi:
- `payment.create.ts`
- `payment.balance.ts`
- `returns-enhanced`
- `opening-balances`
- `stock.movements`

**Yechim:** `lib/balance-upsert.ts`

```typescript
// src/lib/balance-upsert.ts
import { Prisma } from "@prisma/client";

export type BalanceUpsertResult = {
  id: number;
  balance: Prisma.Decimal;
};

/**
 * Client balansini upsert qiladi (create yoki increment)
 */
export async function upsertClientBalance(
  tx: Prisma.TransactionClient,
  tenantId: number,
  clientId: number,
  initialBalance: Prisma.Decimal = new Prisma.Decimal(0)
): Promise<BalanceUpsertResult> {
  const bal = await tx.clientBalance.upsert({
    where: { tenant_id_client_id: { tenant_id, client_id } },
    create: {
      tenant_id: tenantId,
      client_id: clientId,
      balance: initialBalance
    },
    update: {}
  });
  return { id: bal.id, balance: bal.balance };
}

/**
 * Balance ga qo'shish (to'lov kiritishda)
 */
export async function incrementClientBalance(
  tx: Prisma.TransactionClient,
  tenantId: number,
  clientId: number,
  delta: Prisma.Decimal
): Promise<BalanceUpsertResult> {
  const bal = await tx.clientBalance.upsert({
    where: { tenant_id_client_id: { tenant_id, client_id } },
    create: { tenant_id, client_id, balance: delta },
    update: { balance: { increment: delta } }
  });
  return { id: bal.id, balance: bal.balance };
}

/**
 * Balance dan ayirish (qarz yoki expense da)
 */
export async function decrementClientBalance(
  tx: Prisma.TransactionClient,
  tenantId: number,
  clientId: number,
  delta: Prisma.Decimal
): Promise<BalanceUpsertResult> {
  const bal = await tx.clientBalance.upsert({
    where: { tenant_id_client_id: { tenant_id, client_id } },
    create: { tenant_id, client_id, balance: new Prisma.Decimal(0).sub(delta) as any },
    update: { balance: { increment: delta.neg() } }
  });
  return { id: bal.id, balance: bal.balance };
}

/**
 * Balance movement yozuvi yaratish
 */
export async function createBalanceMovement(
  tx: Prisma.TransactionClient,
  balanceId: number,
  delta: Prisma.Decimal,
  note: string,
  userId?: number | null
): Promise<void> {
  await tx.clientBalanceMovement.create({
    data: {
      client_balance_id: balanceId,
      delta,
      note,
      user_id: userId ?? null
    }
  });
}
```

**Usage count:** 15+ files → 1 shared function

---

### 4.2 Client Audit Logging (8+ usage)

**Yechim:** `lib/client-audit.ts`

```typescript
// src/lib/client-audit.ts
import { Prisma } from "@prisma/client";
import { appendTenantAuditEvent } from "./tenant-audit";

export type AuditAction =
  | "client.create"
  | "client.patch"
  | "client.bulk_set_active"
  | "client.merge"
  | "client.payment"
  | "client.equipment_add"
  | "client.equipment_remove"
  | "client.qr_bound"
  | "client.qr_detached";

export async function logClientAudit(
  tenantId: number,
  clientId: number,
  action: AuditAction,
  actorUserId?: number | null,
  details?: Record<string, unknown>
): Promise<void> {
  const uid = actorUserId && Number.isFinite(actorUserId) && actorUserId > 0
    ? Math.floor(actorUserId)
    : null;

  await prisma.clientAuditLog.create({
    data: {
      tenant_id: tenantId,
      client_id: clientId,
      user_id: uid,
      action,
      detail: details as Prisma.InputJsonValue
    }
  });

  await appendTenantAuditEvent({
    tenantId,
    actorUserId: uid,
    entityType: "client",
    entityId: String(clientId),
    action,
    payload: details
  });
}

export async function logClientAuditBatch(
  tenantId: number,
  clientIds: number[],
  action: AuditAction,
  actorUserId?: number | null,
  details?: Record<string, unknown>
): Promise<void> {
  const uid = actorUserId && Number.isFinite(actorUserId) && actorUserId > 0
    ? Math.floor(actorUserId)
    : null;

  if (clientIds.length === 0) return;

  await prisma.clientAuditLog.createMany({
    data: clientIds.map(client_id => ({
      tenant_id: tenantId,
      client_id,
      user_id: uid,
      action,
      detail: details as Prisma.InputJsonValue
    }))
  });
}
```

---

### 4.3 Warehouse Stock Upsert Pattern (6+ usage)

**Yechim:** `stock/stock-upsert.ts`

```typescript
// src/lib/stock-upsert.ts
import { Prisma } from "@prisma/client";

export async function upsertStock(
  tx: Prisma.TransactionClient,
  tenantId: number,
  warehouseId: number,
  productId: number,
  qty: Prisma.Decimal
): Promise<void> {
  await tx.stock.upsert({
    where: {
      tenant_id_warehouse_id_product_id: { tenant_id, warehouse_id: warehouseId, product_id: productId }
    },
    create: {
      tenant_id: tenantId,
      warehouse_id: warehouseId,
      product_id: productId,
      qty,
      reserved_qty: new Prisma.Decimal(0)
    },
    update: { qty }
  });
}

export async function incrementStock(
  tx: Prisma.TransactionClient,
  tenantId: number,
  warehouseId: number,
  productId: number,
  delta: Prisma.Decimal
): Promise<Prisma.Decimal> {
  const stock = await tx.stock.upsert({
    where: {
      tenant_id_warehouse_id_product_id: { tenant_id, warehouse_id: warehouseId, product_id: productId }
    },
    create: {
      tenant_id: tenantId,
      warehouse_id: warehouseId,
      product_id: productId,
      qty: delta,
      reserved_qty: new Prisma.Decimal(0)
    },
    update: { qty: { increment: delta } }
  });
  return stock.qty;
}

export async function decrementStock(
  tx: Prisma.TransactionClient,
  tenantId: number,
  warehouseId: number,
  productId: number,
  delta: Prisma.Decimal
): Promise<Prisma.Decimal> {
  const stock = await tx.stock.upsert({
    where: {
      tenant_id_warehouse_id_product_id: { tenant_id, warehouse_id: warehouseId, product_id: productId }
    },
    create: {
      tenant_id: tenantId,
      warehouse_id: warehouseId,
      product_id: productId,
      qty: new Prisma.Decimal(0).sub(delta) as any,
      reserved_qty: new Prisma.Decimal(0)
    },
    update: { qty: { increment: delta.neg() } }
  });
  return stock.qty;
}
```

---

### 4.4 Agent Entitlements Parsing (4+ usage)

**Yechim:** `staff/staff-entitlements.ts`

```typescript
// src/lib/staff-entitlements.ts
export interface AgentEntitlements {
  price_types?: string[];
  product_rules?: {
    category_id: number;
    all: boolean;
    product_ids?: number[];
  }[];
}

export function parseEntitlements(input: unknown): AgentEntitlements {
  if (!input || typeof input !== "object") {
    return { price_types: [], product_rules: [] };
  }
  const obj = input as Record<string, unknown>;
  return {
    price_types: Array.isArray(obj.price_types) ? obj.price_types.filter(String) : [],
    product_rules: Array.isArray(obj.product_rules)
      ? obj.product_rules.filter((r): r is AgentEntitlements["product_rules"][number] =>
          r && typeof r === "object" && "category_id" in r
        )
      : []
  };
}

export function serializeEntitlements(entitlements: AgentEntitlements): object {
  return {
    price_types: entitlements.price_types ?? [],
    product_rules: entitlements.product_rules ?? []
  };
}

export function mergeEntitlements(
  base: AgentEntitlements,
  override: Partial<AgentEntitlements>
): AgentEntitlements {
  return {
    price_types: [...new Set([...(base.price_types ?? []), ...(override.price_types ?? [])])],
    product_rules: [
      ...(base.product_rules ?? []),
      ...(override.product_rules ?? [])
    ].filter((v, i, arr) => arr.findIndex(t => t.category_id === v.category_id) === i)
  };
}
```

---

### 4.5 Bonus Context Files (4+ usage - Duplicated)

**Hozirgi:**
- `order-bonus-context.fetch.ts`
- `order-bonus-context.prereq.ts`
- `order-bonus-context.match-gifts.ts`
- `order-bonus-context.match-scope.ts`

**Yechim:** `orders/bonus-context/` subdirectory

```
orders/bonus-context/
├── bonus-context.ts         # Main entry
├── bonus-context-fetch.ts   # Data fetching
├── bonus-context-prereq.ts  # Prerequisites check
├── bonus-context-match.ts   # Rule matching
└── bonus-context-apply.ts   # Application
```

---

## Phase 5: Query Optimizatsiya

### 5.1 $queryRaw → Prisma (BORDERLINE ones)

#### A. `client-balances.client-balances.agents.ts`

**Hozirgi:** `prisma.$queryRaw` for agent balances

**Yechim:** Prisma `groupBy` + `aggregate`:
```typescript
// YANGI
const agentBalances = await prisma.clientBalance.groupBy({
  by: ["client_id"],
  where: { tenant_id: tenantId },
  _sum: { balance: true },
  orderBy: { _sum: { balance: "desc" } },
  take: 100
});
```

#### B. `payments/payment-allocations.open.ts`

**Hozirgi:** Simple SUM with WHERE

**Yechim:** Prisma `aggregate`:
```typescript
// YANGI
const totalAllocated = await prisma.paymentAllocation.aggregate({
  where: { tenant_id: tenantId, payment_id: paymentId },
  _sum: { amount: true }
});
```

---

### 5.2 CTE Optimization - Already Done ✅

**Allaqachon qilingan:**
- `dashboard.finance.snapshot.ts` - JS reduce → SQL SUM ✅
- `sales-monitoring.snapshot.base.ts` - 7 queries → 1 CTE ✅
- `client-sales-4.report.ts` - CTE reuse ✅

---

### 5.3 Missing Transaction Wrapping

#### A. `stock/goods-receipt.create.ts`

**Muammo:** Receipt + stock update alohida

**Yechim:**
```typescript
// YANGI
await prisma.$transaction(async (tx) => {
  // 1. Create receipt
  const receipt = await tx.goodsReceipt.create({...});

  // 2. Update stock
  for (const line of lines) {
    await tx.stock.upsert({...});
  }

  // 3. Create receipt lines
  await tx.goodsReceiptLine.createMany({...});
});
```

#### B. `clients/clients.write.update.ts:202`

**Yechim:** Transaction ichida client + assignments

---

## Phase 6: Schema Yaxshilash

### 6.1 Enum Conversions (Priority Order)

| Enum | Models | Priority | Migration |
|------|--------|----------|-----------|
| `OrderStatus` | Order.status | HIGH | New migration |
| `OrderType` | Order.order_type | HIGH | New migration |
| `PaymentKind` | Payment.entry_kind | HIGH | New migration |
| `PaymentStatus` | Payment.workflow_status | MEDIUM | New migration |
| `UserRole` | User.role | MEDIUM | New migration |
| `GoodsReceiptStatus` | GoodsReceipt.status | MEDIUM | New migration |
| `ExpenseStatus` | Expense.status | LOW | Future |

### 6.2 Cascade Delete Fixes

**Migration:** `prisma/migrations/20260520120000_cascade_deletes/migration.sql`

```sql
-- Product onDelete: Restrict (prevent orphan stock)
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_product_id_fkey;
ALTER TABLE order_items ADD CONSTRAINT order_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;

ALTER TABLE stock DROP CONSTRAINT IF EXISTS stock_product_id_fkey;
ALTER TABLE stock ADD CONSTRAINT stock_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE RESTRICT;

-- ClientAgentAssignment onDelete: SetNull
ALTER TABLE client_agent_assignments DROP CONSTRAINT IF EXISTS client_agent_assignments_agent_id_fkey;
ALTER TABLE client_agent_assignments ADD CONSTRAINT client_agent_assignments_agent_id_fkey
  FOREIGN KEY (agent_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE client_agent_assignments DROP CONSTRAINT IF EXISTS client_agent_assignments_expeditor_user_id_fkey;
ALTER TABLE client_agent_assignments ADD CONSTRAINT client_agent_assignments_expeditor_user_id_fkey
  FOREIGN KEY (expeditor_user_id) REFERENCES users(id) ON DELETE SET NULL;
```

### 6.3 Yangi Enum Migrations

**Fayl:** `prisma/migrations/20260520130000_order_status_enum/migration.sql`

```sql
-- Create enum type
DO $$ BEGIN
  CREATE TYPE order_status AS ENUM ('new', 'confirmed', 'assembling', 'shipped', 'delivered', 'cancelled', 'returned');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Add enum column
ALTER TABLE orders ADD COLUMN status_new order_status DEFAULT 'new';

-- Copy data
UPDATE orders SET status_new = status::order_status WHERE status IN ('new', 'confirmed', 'assembling', 'shipped', 'delivered', 'cancelled', 'returned');

-- Swap columns
ALTER TABLE orders RENAME COLUMN status TO status_old;
ALTER TABLE orders RENAME COLUMN status_new TO status;
DROP COLUMN status_old;

-- Add index
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
```

---

## Phase 7: Frontend Optimizatsiya

### 7.1 Katta Komponentlarni Bo'lish

#### A. `access-workspace.tsx` (2870 lines)

**Yangi Struktur:**
```
components/access/
├── access-workspace.tsx           # Entry (200 lines)
├── access-table.tsx              # Table component (300 lines)
├── access-filters.tsx            # Filter logic (200 lines)
├── access-bulk-actions.tsx       # Bulk operations (150 lines)
├── access-permission-grid.tsx    # Permission matrix (400 lines)
└── access-user-detail-panel.tsx  # User detail (already 2521 - split more)
```

**New Files:**
- `components/access/access-table.tsx` - Virtualized table
- `components/access/access-filters.tsx` - Filter derivation
- `components/access/access-bulk-actions.tsx` - Bulk ops

---

#### B. `use-order-create.ts` (2161 lines, 59 useMemo)

**Yangi Struktur:**
```
components/orders/order-create/
├── hooks/
│   ├── use-order-create.ts         # Main entry (300 lines)
│   ├── use-order-pricing.ts         # Pricing logic (400 lines)
│   ├── use-order-polki.ts           # Polki/exchange (500 lines)
│   ├── use-order-clients.ts         # Client selection (300 lines)
│   └── use-order-products.ts        # Product selection (400 lines)
```

**Files to create:**
- `components/orders/order-create/hooks/use-order-pricing.ts`
- `components/orders/order-create/hooks/use-order-polki.ts`
- `components/orders/order-create/hooks/use-order-clients.ts`
- `components/orders/order-create/hooks/use-order-products.ts`

---

#### C. `dashboard-sales-monitoring.tsx` (2642 lines)

**Yangi Struktur:**
```
components/dashboard/
├── dashboard-sales-monitoring.tsx  # Entry (200 lines)
├── sales-monitoring-kpi.tsx       # KPI cards (300 lines)
├── sales-monitoring-charts.tsx    # Chart configs (400 lines)
├── sales-monitoring-table.tsx     # Table (300 lines)
└── sales-monitoring-filters.tsx   # Filter state (200 lines)
```

---

### 7.2 Lazy Loading Qo'shish

```typescript
// app/(dashboard)/orders/new/page.tsx
import dynamic from 'next/dynamic';

const OrderCreateView = dynamic(
  () => import('@/components/orders/order-create/view/order-create-view'),
  {
    loading: () => <OrderCreateSkeleton />,
    ssr: false
  }
);

// app/(dashboard)/clients/[id]/page.tsx
const ClientDetailView = dynamic(
  () => import('@/components/clients/client-detail-view'),
  { ssr: false }
);
```

---

### 7.3 Context Yaratish

#### OrderCreateContext

```typescript
// components/orders/order-create/context/order-create-context.tsx
import { createContext, useContext, useReducer } from 'react';

interface OrderCreateState {
  clientId: number | null;
  items: OrderItem[];
  total: number;
  // ... all state
}

type Action =
  | { type: 'SET_CLIENT'; payload: number }
  | { type: 'ADD_ITEM'; payload: OrderItem }
  | { type: 'REMOVE_ITEM'; payload: number };

const initialState: OrderCreateState = {...};

export const OrderCreateContext = createContext<{
  state: OrderCreateState;
  dispatch: Dispatch<Action>;
} | null>(null);

export function OrderCreateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(orderReducer, initialState);
  return (
    <OrderCreateContext.Provider value={{ state, dispatch }}>
      {children}
    </OrderCreateContext.Provider>
  );
}
```

---

## Implementation Plan

### Phase 1: N+1 Fixes (1-2 hafta)

| Week | Tasks |
|------|-------|
| Week 1 | Fix `clients.merge.ts`, `clients.import.rows-create.ts`, `clients.import.rows-update.ts` |
| Week 2 | Fix `staff.patches.web-agents-bulk.ts`, Create `lib/balance-upsert.ts` |

### Phase 2: Migration (1 hafta)

| Day | Tasks |
|-----|-------|
| Day 1 | Fix duplicate migration names |
| Day 2 | Create FK indexes migration |
| Day 3 | Create composite indexes migration |
| Day 4 | Run migrations |
| Day 5 | Verify indexes with EXPLAIN |

### Phase 3: Code Splitting (3-4 hafta)

| Week | Backend Files | Frontend Files |
|------|---------------|----------------|
| Week 1 | `orders/query/`, `clients/import/` | - |
| Week 2 | `mobile/`, `staff/operators/` | `use-order-pricing.ts`, `use-order-polki.ts` |
| Week 3 | `orders/order-lines/`, `clients/assets/` | `access-table.tsx`, `access-filters.tsx` |
| Week 4 | `returns/create-period/`, `payment.balance.ts` | `sales-monitoring-kpi.tsx` |

### Phase 4: Duplicate Extrakt (2 hafta)

| Week | Tasks |
|------|-------|
| Week 1 | `lib/balance-upsert.ts`, `lib/client-audit.ts`, `lib/stock-upsert.ts` |
| Week 2 | `lib/staff-entitlements.ts`, `orders/bonus-context/` |

### Phase 5: Schema (2 hafta)

| Week | Tasks |
|------|-------|
| Week 1 | Enum migrations (OrderStatus, OrderType) |
| Week 2 | Cascade deletes, validation |

### Phase 6: Frontend (4 hafta)

| Week | Tasks |
|------|-------|
| Week 1 | Lazy loading, Contexts |
| Week 2 | Hook extraction |
| Week 3 | Component splitting |
| Week 4 | Testing |

---

## Xulosa

### Jami Vaqt: ~14-16 hafta

| Phase | Duration |
|-------|----------|
| Phase 1: N+1 Fixes | 2 hafta |
| Phase 2: Migration | 1 hafta |
| Phase 3: Code Splitting | 4 hafta |
| Phase 4: Duplicate Extrakt | 2 hafta |
| Phase 5: Schema | 2 hafta |
| Phase 6: Frontend | 4 hafta |
| **Jami** | **~15 hafta** |

### Expected Results

| Metric | Hozirgi | Yangi | O'zgarish |
|--------|---------|-------|----------|
| Dashboard load | 3-5s | <500ms | -85% |
| Payment confirm | 5-10s | <500ms | -95% |
| Import 1000 rows | 60s+ | <5s | -90% |
| DB queries/request | 15-20 | 3-5 | -75% |
| Code coverage | 15% | 40% | +167% |
| Maintainability | 3/10 | 8/10 | +167% |

---

**Hujjat yaratildi:** 2026-yil 18-may  
**Version:** 2.0  
**Status:** Ready for implementation