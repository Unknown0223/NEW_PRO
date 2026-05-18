# SALEC Loyhasi - To'liq Tahlil va Qayta Qurish Rejasi

**Tahlil sanasi:** 2026-yil 18-may  
**Loyha hajmi:** ~220,000 kod satri  
**Tekshiruvchi:** Senior Developer Audit

---

## 📋 Mundarija

1. [Executive Summary](#executive-summary)
2. [Joriy Holat Tahlili](#joriy-holat-tahlili)
3. [Aniqlangan Muammolar](#aniqlangan-muammolar)
4. [Varyant A: 0-dan Qayta Qurish](#varyant-a-0-dan-qayta-qurish)
5. [Varyant B: Joriy Holatni Tuzatish](#varyant-b-joriy-holatni-tuzatish)
6. [Taqqoslash va Tavsiya](#taqqoslash-va-tavsiya)
7. [Xulosa](#xulosa)

---

## Executive Summary

### Loyha Haqida

**SALEC** — bu murakkab Sales Distribution Management System (Sotuv va Tarqatish Boshqaruv Tizimi). Loyha O'zbekistondagi distributor kompaniyalar uchun mo'ljallangan bo'lib, quyidagi asosiy funksiyalarni qamrab oladi:

- Multi-tenant arxitektura (bir nechta dilerlar uchun)
- Agentlar boshqaruvi va GPS tracking
- Buyurtmalar va to'lovlar boshqaruvi
- Omborga olish va transferlar
- Bonus tizimi
- Hisobotlar va analytics
- Mobil ilova integratsiyasi

### Statistika

| Ko'rsatkich | Qiymat |
|-------------|--------|
| Jami fayllar | ~1,150 |
| Jami kod satri | ~220,000 |
| Backend fayllar | 683 |
| Frontend fayllar | 482 |
| Database jadvallar | 81 |
| Backend modullar | 33+ |
| Frontend sahifalar | 120+ |

### Joriy Texnologiya Stack

```
Frontend:     Next.js 14.2.35 + TypeScript + TanStack Query v5 + Zustand + Tailwind v3
Backend:      Fastify 4.x + TypeScript + Prisma 6.x + BullMQ + Redis
Database:     PostgreSQL 16
Infrastructure: Docker + PM2 + Nginx
```

---

## Joriy Holat Tahlili

### 1. Backend Arxitektura

#### 1.1 Katalog Strukturasi

```
backend/
├── src/
│   ├── index.ts                    # API server entry (245 lines)
│   ├── app.ts                      # Fastify app builder (227 lines)
│   ├── worker/
│   │   └── index.ts                # BullMQ background worker
│   ├── config/
│   │   ├── env.ts                  # Environment validation (Zod)
│   │   ├── database.ts             # Prisma singleton
│   │   └── logger.ts               # Pino logger setup
│   ├── modules/                    # 33 feature modules
│   │   ├── auth/                   # Authentication (JWT)
│   │   ├── clients/                # Client management (66 files, ~7,500 lines)
│   │   ├── orders/                 # Order management (37 files, ~5,500 lines)
│   │   ├── stock/                  # Inventory (77 files, ~8,000 lines)
│   │   ├── reports/                # Reporting (28 files, ~4,000 lines)
│   │   ├── dashboard/              # Analytics (24 files, ~5,500 lines)
│   │   ├── payments/               # Payments & FIFO (28 files, ~3,500 lines)
│   │   ├── staff/                  # User management (50+ files)
│   │   ├── products/               # Product catalog (35+ files)
│   │   ├── access/                 # RBAC (30+ files)
│   │   └── [24 more modules...]
│   ├── contracts/                  # Zod validation schemas
│   ├── jobs/                       # Background queue
│   ├── lib/                        # Shared utilities
│   │   ├── redis-cache.ts          # Redis caching with fallback
│   │   ├── order-event-bus.ts      # Order event pub/sub
│   │   ├── api-error.ts            # Error handling
│   │   └── pagination.ts           # Pagination helpers
│   └── plugins/
│       ├── jwt.plugin.ts           # JWT authentication
│       ├── tenant.plugin.ts        # Multi-tenant context
│       └── request-observability.plugin.ts
├── prisma/
│   ├── schema.prisma               # 1,997 lines - 81 models
│   └── seed.ts                    # Database seeding
└── tests/                          # Integration + unit tests
```

#### 1.2 Modullar Tahlili

| Modul | Fayllar | Qatorlar | Asosiy funksiya |
|-------|---------|----------|-----------------|
| clients | 66 | ~7,500 | Mijozlar boshqaruvi, import, dedupekatsiya |
| stock | 77 | ~8,000 | Ombor, transferlar, stock takes |
| orders | 37 | ~5,500 | Buyurtmalar, bonus hisoblash |
| reports | 28 | ~4,000 | Hisobotlar, analytics |
| dashboard | 24 | ~5,500 | Dashboard snapshots, caching |
| payments | 28 | ~3,500 | To'lovlar, FIFO allocation |
| staff | 50+ | ~6,000 | Xodimlar, rollar |
| products | 35+ | ~4,500 | Mahsulotlar, narxlar |
| access | 30+ | ~4,000 | RBAC, permissions |

#### 1.3 Katta Fayllar (>200 qator) - 71 ta

| Fayl | Qatorlar | Muammo |
|------|----------|--------|
| order.query.ts | 337 | Buyurtma ro'yxati - murakkab query |
| order.lifecycle.ts | 340 | Status o'tishlari - murakkab logic |
| clients.import.main.ts | 364 | Excel import - ko'p code paths |
| dashboard.finance.snapshot.ts | 366 | 25+ $queryRaw - analytics |
| order.types.ts | 361 | Type definitionlar |
| order.lines.ts | 363 | Line item manipulation |
| staff.crud.list.ts | 297 | Filter logic |
| tenant-settings.territory.ts | 355 | Territory boshqaruv |

### 2. Frontend Arxitektura

#### 2.1 Katalog Strukturasi

```
frontend/
├── app/
│   ├── (dashboard)/               # Authenticated pages
│   │   ├── dashboard/             # Dashboard variants
│   │   ├── orders/                 # Order management
│   │   ├── clients/                # Client management
│   │   ├── payments/              # Payment management
│   │   ├── stock/                 # Inventory
│   │   ├── products/              # Product catalog
│   │   ├── reports/               # Reporting
│   │   ├── settings/              # Settings pages
│   │   └── [30+ more routes...]
│   ├── login/                     # Authentication
│   └── api/[[...path]]/           # API proxy
├── components/
│   ├── ui/                        # shadcn/ui base components
│   ├── access/                    # RBAC components
│   ├── clients/                    # Client components
│   ├── dashboard/                 # Dashboard widgets
│   ├── orders/                    # Order components
│   ├── payments/                  # Payment components
│   ├── products/                  # Product components
│   ├── reports/                   # Report components
│   ├── staff/                     # Staff components
│   ├── stock/                     # Stock components
│   └── work-slots/                # Work slot components
├── hooks/                         # Custom hooks (2 ta)
├── lib/
│   ├── api.ts                     # Axios client (224 lines)
│   ├── api-client.ts              # Fetch client
│   ├── auth-store.ts              # Zustand store
│   └── utils.ts                   # Utilities
└── e2e/                           # Playwright tests
```

#### 2.2 Katta Komponentlar (>1000 qator) - 15 ta

| Fayl | Qatorlar | Muammo |
|------|----------|--------|
| access-workspace.tsx | 2,870 | Rol boshqaruvi - ajratish kerak |
| wdr-report-builder.tsx | 2,698 | Pivot table - ajratish kerak |
| dashboard-sales-monitoring.tsx | 2,642 | Real-time charts |
| access-user-detail-panel.tsx | 2,521 | User detail - ajratish kerak |
| agents-workspace.tsx | 2,452 | Agent boshqaruv |
| client-balances-workspace.tsx | 2,206 | Balance ledger |
| use-order-create.ts | 2,161 | Order creation hook (50+ useMemo) |
| order-create-view.tsx | 2,100 | Order create UI |
| orders/page.tsx | 2,066 | Orders list |
| skladchik-workspace.tsx | 1,876 | Warehouse staff |
| client-edit-form.tsx | 1,833 | Client form |
| dashboard-home.tsx | 1,829 | Dashboard home |

### 3. Database Schema

#### 3.1 Modellar (81 ta)

**Asosiy modellar:**

| # | Model | Asosiy fieldlar | Bog'liqlar |
|---|-------|-----------------|------------|
| 1 | Tenant | id, slug, name, plan | 50+ children |
| 2 | User | id, tenant_id, login, role, password_hash | 30+ relations |
| 3 | Client | id, tenant_id, name, phone, agent_id | 20+ relations |
| 4 | Product | id, tenant_id, sku, name, category_id | 10+ relations |
| 5 | Order | id, tenant_id, number, client_id, agent_id | 10+ relations |
| 6 | OrderItem | id, order_id, product_id, qty, price | 2 FK |
| 7 | Payment | id, tenant_id, client_id, order_id, amount | 6 FK |
| 8 | PaymentAllocation | id, payment_id, order_id, amount | 2 FK |
| 9 | SalesReturn | id, tenant_id, number, client_id | 5 FK |
| 10 | ClientBalance | id, tenant_id, client_id, balance | 2 FK |
| 11 | Stock | tenant_id, warehouse_id, product_id, qty | 3 FK |
| 12 | Warehouse | id, tenant_id, name, type | 8+ relations |
| 13 | GoodsReceipt | id, tenant_id, number, warehouse_id | 6 FK |
| 14 | BonusRule | id, tenant_id, type | Pivot + 1:N |
| 15 | WorkSlot | id, tenant_id, slot_code, slot_type | 3 relations |
| 16 | Role | id, tenant_id, key | 3 FK |
| 17 | Permission | id, tenant_id, key, module | 3 FK |
| 18-81 | [Others] | Turli xil | Various |

#### 3.2 Indexlar

**Mavjud yaxshi indexlar:**
```prisma
@@index([tenant_id])
@@index([tenant_id, created_at(sort: Desc)])
@@unique([tenant_id, login])
```

**Kamchilik indexlar:**
- `User.supervisor_user_id` - yo'q
- `Product(tenant_id, is_active)` - yo'q
- `Product(tenant_id, barcode)` - yo'q
- `Orders(tenant_id, agent_id, status)` - yo'q

---

## Aniqlangan Muammolar

### Kritik Muammolar (P0)

#### 1. RBAC da Promise await yo'q

**Fayl:** `modules/access/rbac.permissions.ts:39-48`

```typescript
// XATO - promise'lar kutilmayapti!
missing.map(async (key) => {
  const permission = await getPermission(key, request);
  if (!permission) {
    missingPermissions.push(key);
  }
});
```

**Ta'sir:** Role permissions to'liq yuklanmaydi, RBAC buzilishi mumkin.

**Yechim:**
```typescript
// TO'G'RI
const results = await Promise.all(missing.map(async (key) => {
  return await getPermission(key, request);
}));
const missingPermissions = results.filter(p => !p).map((_, i) => missing[i]);
```

#### 2. To'lov tasdiqlashda transaction yo'q

**Fayl:** `modules/payments/payment.balance.ts:245`

```typescript
await prisma.$transaction(async (tx) => {
  // confirm payment...
});
// BU QISM TRANSACTION ICHIDA EMAS!
await allocatePayment(...);
```

**Ta'sir:** Payment tasdiqlanadi lekin allocation muvaffaqiyatsiz bo'lsa, ma'lumot chalkishi mumkin.

**Yechim:**
```typescript
await prisma.$transaction(async (tx) => {
  await tx.payment.update(...);
  await tx.paymentAllocation.createMany(...); // transaction ichida
});
```

#### 3. Warehouse transferlarda incomplete transaction

**Fayl:** `modules/stock/warehouse-transfers.lifecycle.ts:46-84`

Multiple `$transaction` chaqiruvlari bor lekin ular bir-biriga bog'liq. Bitta transaction ichida bo'lishi kerak.

### Yuqori Prioritet (P1)

#### 4. N+1 Query Patterns

**1. `clients.detail.ts:44-283`** - 10+ sequential queries:
```typescript
// Har bir query alohida await
const client = await prisma.client.findFirst(...);     // line 44
const balance = await prisma.clientBalance.findUnique(...); // line 107
const logs = await prisma.clientAuditLog.findFirst(...);     // line 112
// ... yana 7 ta query
```

**Yechim:** `Promise.all()` yoki `include`:
```typescript
const data = await prisma.client.findFirst({
  where,
  include: {
    balances: true,
    auditLogs: { take: 10, orderBy: { created_at: 'desc' } },
    // ...
  }
});
```

**2. `returns-enhanced.client-data.ts:22-326`** - Multiple findMany in loops:
```typescript
// 10+ findMany calls in loop
lines.forEach(line => {
  const data = await prisma.orders.findMany(...);
});
```

#### 5. Katta Fayllar

71 ta fayl 200+ qatordan iborat. Har biri alohida qismlarga bo'linishi kerak.

**Priority split:**
1. `order.query.ts` (337) → query-builder + filters + pagination
2. `order.lifecycle.ts` (340) → status-transitions + actions
3. `clients.import.main.ts` (364) → parsers + validators + batch-processor
4. `dashboard.finance.snapshot.ts` (366) → query-builders + aggregations

#### 6. $queryRaw Usage - 213 ta

**Justified:** Dashboard analytics, bonus calculation, financial reports

**Not justified:** `clients.list.where.ts:16` - oddiy filter uchun:
```typescript
// HOZIRGI - noto'g'ri
const result = await prisma.$queryRawUnsafe(
  `SELECT * FROM clients WHERE phone_normalized = $1`,
  phone
);

// YECHIM - Prisma orqali
const result = await prisma.client.findFirst({
  where: { phone_normalized }
});
```

### O'rta Prioritet (P2)

#### 7. Missing Database Indexes

```sql
-- Qo'shish kerak
CREATE INDEX idx_users_supervisor ON users(supervisor_user_id);
CREATE INDEX idx_products_active ON products(tenant_id, is_active);
CREATE INDEX idx_products_barcode ON products(tenant_id, barcode);
CREATE INDEX idx_orders_agent_status ON orders(tenant_id, agent_id, status);
```

#### 8. String Enum yo'q

Barcha status va type fieldlar String, enum bo'lishi kerak:
```prisma
// HOZIRGI
status String @default("new")

// YECHIM
enum OrderStatus {
  new
  confirmed
  assembling
  shipped
  delivered
  cancelled
}

status OrderStatus @default(new)
```

#### 9. Rate Limiting faqat login

```typescript
// HOZIRGI - faqat login marshrutida
app.register(rateLimit, { global: false });
// Login route'ga max: { max: 30, timeMs: 900000 } berilgan

// YECHIM - barcha public endpointlarga
app.register(rateLimit, {
  global: true,
  max: 100,
  timeMs: 60000
});
```

#### 10. Redis single connection

```typescript
// HOZIRGI
const redis = new Redis(redisUrl);

// YECHIM - connection pool
const redis = new Redis.Cluster([...nodes], {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  scaleReads: 'slave'
});
```

### Past Prioritet (P3)

#### 11. No API versioning

Marshrutlar `/api/:slug/...` formatida, version yo'q.

#### 12. Security headers yo'q

Helmet.js qo'shilmagan.

#### 13. No circuit breakers

Tashqi servislar uchun circuit breaker yo'q.

---

## Varyant A: 0-dan Qayta Qurish

### 1. Arxitektura Prinsiplari

```
┌─────────────────────────────────────────────────────────────┐
│                      CLIENT LAYER                           │
│  Next.js 15 (React Server Components) + TanStack Query v6  │
└─────────────────────────────────────────────────────────────┘
                              │
                    REST API / tRPC
                              │
┌─────────────────────────────────────────────────────────────┐
│                    API LAYER                                │
│  Fastify 5 + Drizzle ORM + BullMQ                          │
│  Domain-Driven Design + Event Sourcing                     │
└─────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────┐
│                  INFRASTRUCTURE LAYER                       │
│  PostgreSQL 16 + Redis Cluster + BullMQ                    │
│  Event Store + CQRS + Read Replicas                        │
└─────────────────────────────────────────────────────────────┘
```

### 2. Texnologiya Tanlovi

| Hozirgi | Yangi | Sabab |
|---------|-------|-------|
| Prisma 6 | Drizzle ORM | 2-3x tezroq, type-safe, raw SQL bor |
| Next.js 14 | Next.js 15 | RSC, Server Actions, tezroq |
| TanStack Query v5 | v6 | Better caching, optimistic updates |
| Fastify 4 | Fastify 5 | Built-in streaming, better perf |
| Monorepo (manual) | Turborepo | Better caching, parallelism |
| Single DB | DB + Read Replicas | Query/Command separation |

### 3. Optimal Struktur

```
salec-v2/
├── apps/
│   ├── api/                        # Fastify + Drizzle
│   │   ├── src/
│   │   │   ├── domain/             # Domain modules
│   │   │   │   ├── clients/
│   │   │   │   │   ├── commands/   # Write operations
│   │   │   │   │   ├── queries/    # Read operations
│   │   │   │   │   ├── entities/   # Domain objects
│   │   │   │   │   └── events/      # Domain events
│   │   │   │   ├── orders/
│   │   │   │   ├── inventory/
│   │   │   │   ├── payments/
│   │   │   │   ├── products/
│   │   │   │   └── workforce/
│   │   │   ├── application/        # Use cases, services
│   │   │   │   ├── client-service.ts
│   │   │   │   └── order-service.ts
│   │   │   ├── infrastructure/     # External integrations
│   │   │   │   ├── database/
│   │   │   │   │   ├── schema.ts   # Drizzle schema
│   │   │   │   │   └── migrations/
│   │   │   │   ├── cache/          # Redis
│   │   │   │   ├── queue/          # BullMQ
│   │   │   │   └── bus/            # Event bus
│   │   │   ├── api/                # HTTP layer
│   │   │   │   ├── routes/
│   │   │   │   │   ├── clients/
│   │   │   │   │   │   ├── client.routes.ts
│   │   │   │   │   │   ├── client.schemas.ts
│   │   │   │   │   │   └── client.handlers.ts
│   │   │   │   ├── orders/
│   │   │   │   └── index.ts
│   │   │   ├── plugins/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── tenant.ts
│   │   │   │   └── tracing.ts
│   │   │   └── shared/
│   │   │       ├── types/
│   │   │       ├── errors/
│   │   │       └── utils/
│   │   └── drizzle.config.ts
│   │
│   ├── web/                        # Next.js 15
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── (auth)/
│   │   │   │   ├── (dashboard)/
│   │   │   │   └── api/
│   │   │   ├── components/        # RSC first
│   │   │   │   ├── ui/             # Base components
│   │   │   │   ├── features/      # Feature components
│   │   │   │   └── layouts/        # Layout components
│   │   │   ├── actions/            # Server Actions
│   │   │   ├── hooks/              # TanStack Query hooks
│   │   │   ├── stores/             # Zustand stores
│   │   │   └── lib/
│   │   ├── next.config.ts
│   │   └── tsconfig.json
│   │
│   └── worker/                     # Background jobs
│       └── src/
│           ├── jobs/              # BullMQ processors
│           └── schedulers/        # Cron jobs
│
├── packages/
│   ├── types/                     # Shared Zod schemas
│   ├── ui/                        # shadcn/ui components
│   └── config/                    # Shared configs
│
├── infra/
│   ├── docker/
│   │   ├── api.Dockerfile
│   │   ├── web.Dockerfile
│   │   └── docker-compose.yml
│   └── terraform/
│
├── turbo.json                     # Turborepo config
└── package.json
```

### 4. Backend Implementation Plan

#### Phase 1: Foundation (Hafta 1-3)

**1.1 Project Setup**
```bash
# Turborepo init
npx create-turbo@latest salec-v2

# Package structure
mkdir apps/api apps/web apps/worker packages/{types,ui,config}
```

**1.2 Database Schema (Drizzle)**
```typescript
// apps/api/src/infrastructure/database/schema.ts
import { pgTable, uuid, varchar, timestamp, decimal, boolean, integer, text, jsonb } from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  slug: varchar('slug', { length: 64 }).unique().notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  address: text('address'),
  logoUrl: varchar('logo_url', { length: 500 }),
  plan: varchar('plan', { length: 32 }).default('basic'),
  isActive: boolean('is_active').default(true),
  settings: jsonb('settings').default({}),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  login: varchar('login', { length: 128 }).notNull(),
  passwordHash: varchar('password_hash', { length: 255 }).notNull(),
  role: varchar('role', { length: 32 }).notNull(), // enum: agent, admin, operator, etc.
  firstName: varchar('first_name', { length: 128 }),
  lastName: varchar('last_name', { length: 128 }),
  phone: varchar('phone', { length: 20 }),
  isActive: boolean('is_active').default(true),
  supervisorUserId: uuid('supervisor_user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_users_tenant').on(table.tenantId),
  index('idx_users_tenant_active').on(table.tenantId, table.isActive),
  index('idx_users_supervisor').on(table.supervisorUserId),
  unique('idx_users_tenant_login').on(table.tenantId, table.login),
]);

export const clients = pgTable('clients', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  name: varchar('name', { length: 255 }).notNull(),
  phone: varchar('phone', { length: 20 }),
  phoneNormalized: varchar('phone_normalized', { length: 20 }),
  address: text('address'),
  latitude: decimal('latitude', { precision: 10, scale: 7 }),
  longitude: decimal('longitude', { precision: 10, scale: 7 }),
  agentId: uuid('agent_id').references(() => users.id),
  creditLimit: decimal('credit_limit', { precision: 15, scale: 2 }).default(0),
  isActive: boolean('is_active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_clients_tenant').on(table.tenantId),
  index('idx_clients_tenant_active').on(table.tenantId, table.isActive),
  index('idx_clients_agent').on(table.agentId),
  index('idx_clients_phone_normalized').on(table.phoneNormalized),
]);

export const orders = pgTable('orders', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id).notNull(),
  number: varchar('number', { length: 32 }).notNull(),
  clientId: uuid('client_id').references(() => clients.id).notNull(),
  agentId: uuid('agent_id').references(() => users.id),
  status: varchar('status', { length: 32 }).notNull().default('new'),
  orderType: varchar('order_type', { length: 32 }).notNull().default('order'),
  totalSum: decimal('total_sum', { precision: 15, scale: 2 }).default(0),
  discountSum: decimal('discount_sum', { precision: 15, scale: 2 }).default(0),
  paidSum: decimal('paid_sum', { precision: 15, scale: 2 }).default(0),
  warehouseId: uuid('warehouse_id').references(() => warehouses.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
}, (table) => [
  index('idx_orders_tenant').on(table.tenantId),
  index('idx_orders_tenant_type_created').on(table.tenantId, table.orderType, table.createdAt),
  index('idx_orders_client').on(table.clientId),
  index('idx_orders_agent').on(table.agentId),
  index('idx_orders_status').on(table.status),
]);
```

**1.3 Authentication Module**
```typescript
// apps/api/src/plugins/auth.ts
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import { z } from 'zod';

const loginSchema = z.object({
  login: z.string().min(1),
  password: z.string().min(1),
  tenantSlug: z.string().min(1),
});

export async function authPlugin(fastify: Fastify) {
  fastify.register(jwt, {
    secret: process.env.JWT_SECRET!,
    sign: { expiresIn: '15m' },
  });

  fastify.post('/auth/login', async (request, reply) => {
    const { login, password, tenantSlug } = loginSchema.parse(request.body);

    const tenant = await db.query.tenants.findFirst({
      where: eq.tenants.slug, tenantSlug),
      where: eq.tenants.isActive, true),
    });

    if (!tenant) {
      throw new UnauthorizedError('Tenant not found');
    }

    const user = await db.query.users.findFirst({
      where: and(
        eq(users.tenantId, tenant.id),
        eq(users.login, login),
        eq(users.isActive, true)
      ),
    });

    if (!user || !await bcrypt.compare(password, user.passwordHash)) {
      throw new UnauthorizedError('Invalid credentials');
    }

    const accessToken = fastify.jwt.sign({
      sub: user.id,
      tenantId: tenant.id,
      role: user.role,
    });

    const refreshToken = await generateRefreshToken(user.id);

    return { accessToken, refreshToken, user: sanitizeUser(user) };
  });
}
```

**1.4 Multi-tenant Plugin**
```typescript
// apps/api/src/plugins/tenant.ts
import { FastifyRequest, FastifyReply } from 'fastify';
import { db } from '../infrastructure/database';
import { tenants } from '../infrastructure/database/schema';
import { eq, and } from 'drizzle-orm';

declare module 'fastify' {
  interface FastifyRequest {
    tenant?: typeof tenants.$inferSelect;
    user?: UserPayload;
  }
}

export async function tenantPlugin(fastify: Fastify) {
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    const slug = request.headers['x-tenant-slug'] as string ||
                 request.url.split('/')[3]; // /api/:slug/...

    if (!slug) return;

    const tenant = await db.query.tenants.findFirst({
      where: and(eq(tenants.slug, slug), eq(tenants.isActive, true)),
    });

    if (!tenant) {
      return reply.status(404).send({ error: 'TENANT_NOT_FOUND' });
    }

    request.tenant = tenant;
  });
}
```

#### Phase 2: Domain Modules (Hafta 4-7)

**2.1 Client Module (CQRS Pattern)**

```typescript
// apps/api/src/domain/clients/queries/client-list.query.ts
export async function getClients(params: ClientListParams) {
  const { tenantId, search, agentId, page, pageSize } = params;

  const where = and(
    eq(clients.tenantId, tenantId),
    eq(clients.isActive, true),
    search ? or(
      like(clients.name, `%${search}%`),
      like(clients.phone, `%${search}%`)
    ) : undefined,
    agentId ? eq(clients.agentId, agentId) : undefined
  );

  const [data, total] = await Promise.all([
    db.select()
      .from(clients)
      .where(where)
      .limit(pageSize)
      .offset((page - 1) * pageSize)
      .orderBy(desc(clients.createdAt)),
    db.select({ count: count() })
      .from(clients)
      .where(where),
  ]);

  return { data, total: total[0].count, page, pageSize };
}

// apps/api/src/domain/clients/commands/create-client.command.ts
export async function createClient(data: CreateClientDTO) {
  const phoneNormalized = data.phone?.replace(/\D/g, '');

  const existing = await db.query.clients.findFirst({
    where: and(
      eq(clients.tenantId, data.tenantId),
      phoneNormalized ? eq(clients.phoneNormalized, phoneNormalized) : undefined
    ),
  });

  if (existing) {
    throw new ConflictError('Client with this phone already exists');
  }

  const [client] = await db.insert(clients).values({
    ...data,
    phoneNormalized,
  }).returning();

  await publishEvent('client.created', { clientId: client.id, tenantId: data.tenantId });

  return client;
}
```

**2.2 Order Module (with Bonus Engine)**

```typescript
// apps/api/src/domain/orders/entities/order.entity.ts
export interface Order {
  id: string;
  tenantId: string;
  number: string;
  clientId: string;
  agentId: string;
  status: OrderStatus;
  orderType: OrderType;
  items: OrderItem[];
  totalSum: number;
  discountSum: number;
  bonusSum: number;
  paidSum: number;
  createdAt: Date;
  updatedAt: Date;
}

export type OrderStatus = 'new' | 'confirmed' | 'assembling' | 'shipped' | 'delivered' | 'cancelled';
export type OrderType = 'order' | 'return' | 'exchange' | 'partial_return';

// apps/api/src/domain/orders/services/bonus-engine.service.ts
export class BonusEngineService {
  async calculateBonus(orderId: string): Promise<BonusResult> {
    const order = await this.getOrderWithItems(orderId);
    const activeRules = await this.getActiveBonusRules(order.tenantId);

    let totalBonus = 0;
    const appliedRules: AppliedRule[] = [];

    for (const rule of activeRules) {
      const result = this.evaluateRule(rule, order);
      if (result.isApplicable) {
        totalBonus += result.bonusAmount;
        appliedRules.push(result);
      }
    }

    await this.saveBonusCalculation(orderId, appliedRules, totalBonus);

    return { totalBonus, appliedRules };
  }

  private evaluateRule(rule: BonusRule, order: Order): EvaluationResult {
    // Check prerequisites
    if (!this.checkPrerequisites(rule.prerequisites, order)) {
      return { isApplicable: false, bonusAmount: 0 };
    }

    // Check scope (products, categories)
    const matchingItems = this.getMatchingItems(rule, order.items);
    if (matchingItems.length === 0) {
      return { isApplicable: false, bonusAmount: 0 };
    }

    // Calculate bonus
    const baseAmount = matchingItems.reduce((sum, item) =>
      sum + (item.qty * item.price), 0
    );

    let bonusAmount = 0;
    if (rule.type === 'percentage') {
      bonusAmount = baseAmount * (rule.value / 100);
    } else if (rule.type === 'fixed') {
      bonusAmount = rule.value * matchingItems.length;
    } else if (rule.type === 'tiered') {
      bonusAmount = this.calculateTieredBonus(rule.tiers, baseAmount);
    }

    return { isApplicable: true, bonusAmount, appliedItems: matchingItems };
  }
}
```

**2.3 Inventory Module (Stock Management)**

```typescript
// apps/api/src/domain/inventory/services/stock.service.ts
export class StockService {
  async reserveStock(orderId: string, items: ReserveItem[]): Promise<void> {
    await db.transaction(async (tx) => {
      for (const item of items) {
        const [stock] = await tx
          .select()
          .from(stocks)
          .where(and(
            eq(stocks.warehouseId, item.warehouseId),
            eq(stocks.productId, item.productId)
          ))
          .for('update');

        if (stock.qty < item.qty) {
          throw new InsufficientStockError(item.productId, stock.qty, item.qty);
        }

        await tx.update(stocks)
          .set({ qty: stock.qty - item.qty })
          .where(eq(stocks.id, stock.id));

        await tx.insert(stockReservations).values({
          orderId,
          productId: item.productId,
          warehouseId: item.warehouseId,
          qty: item.qty,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h expiry
        });
      }
    });
  }

  async transferStock(params: TransferParams): Promise<void> {
    const { fromWarehouseId, toWarehouseId, items, reason } = params;

    await db.transaction(async (tx) => {
      // Deduct from source
      for (const item of items) {
        await tx.execute(sql`
          UPDATE stocks
          SET qty = qty - ${item.qty}
          WHERE warehouse_id = ${fromWarehouseId}
            AND product_id = ${item.productId}
            AND qty >= ${item.qty}
        `);
      }

      // Add to destination
      for (const item of items) {
        await tx.execute(sql`
          INSERT INTO stocks (warehouse_id, product_id, qty, tenant_id)
          VALUES (${toWarehouseId}, ${item.productId}, ${item.qty}, ${params.tenantId})
          ON CONFLICT (warehouse_id, product_id)
          DO UPDATE SET qty = stocks.qty + ${item.qty}
        `);
      }

      // Record transfer
      const [transfer] = await tx.insert(warehouseTransfers).values({
        fromWarehouseId,
        toWarehouseId,
        reason,
        status: 'completed',
        createdBy: params.userId,
      }).returning();

      for (const item of items) {
        await tx.insert(warehouseTransferItems).values({
          transferId: transfer.id,
          productId: item.productId,
          qty: item.qty,
        });
      }
    });

    await publishEvent('inventory.transferred', params);
  }
}
```

#### Phase 3: Frontend (Hafta 8-12)

**3.1 Project Structure**

```typescript
// apps/web/src/app/(dashboard)/clients/page.tsx
// Server Component - data fetching
import { getClients } from '@/actions/clients';
import { ClientList } from '@/components/features/clients/client-list';

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: { q?: string; page?: string };
}) {
  const clients = await getClients({
    search: searchParams.q,
    page: parseInt(searchParams.page || '1'),
    pageSize: 20,
  });

  return <ClientList initialData={clients} />;
}

// apps/web/src/components/features/clients/client-list.tsx
// Client Component - interactivity
'use client';

import { useQuery } from '@tanstack/react-query';
import { clientQueries } from '@/hooks/queries/client-keys';
import { ClientTable } from './client-table';
import { ClientFilters } from './client-filters';

export function ClientList({ initialData }: { initialData: ClientsResult }) {
  const { data } = useQuery({
    ...clientQueries.list(initialData.params),
    initialData,
    staleTime: 90 * 1000,
  });

  return (
    <div className="space-y-4">
      <ClientFilters />
      <ClientTable clients={data.items} />
      <Pagination total={data.total} page={data.page} />
    </div>
  );
}
```

**3.2 TanStack Query Hooks**

```typescript
// apps/web/src/hooks/queries/client-keys.ts
export const clientKeys = {
  all: ['clients'] as const,
  lists: () => [...clientKeys.all, 'list'] as const,
  list: (params: ClientListParams) => [...clientKeys.lists(), params] as const,
  details: () => [...clientKeys.all, 'detail'] as const,
  detail: (id: string) => [...clientKeys.details(), id] as const,
};

// apps/web/src/hooks/queries/clients.ts
export const clientQueries = {
  list: (params: ClientListParams) => ({
    queryKey: clientKeys.list(params),
    queryFn: () => api.get<ClientsResult>('/clients', { params }),
  }),
  detail: (id: string) => ({
    queryKey: clientKeys.detail(id),
    queryFn: () => api.get<ClientDetail>(`/clients/${id}`),
    staleTime: 5 * 60 * 1000, // 5 minutes for detail
  }),
};
```

**3.3 Server Actions**

```typescript
// apps/web/src/actions/clients.ts
'use server';

import { revalidateTag } from 'next/cache';
import { z } from 'zod';

const createClientSchema = z.object({
  name: z.string().min(1).max(255),
  phone: z.string().optional(),
  address: z.string().optional(),
  agentId: z.string().uuid().optional(),
});

export async function createClient(data: unknown) {
  const parsed = createClientSchema.safeParse(data);

  if (!parsed.success) {
    return { error: parsed.error.flatten() };
  }

  const result = await api.post('/clients', parsed.data);

  revalidateTag('clients');

  return result;
}
```

#### Phase 4: Testing & Deployment (Hafta 13-16)

**4.1 Test Strategy**

```typescript
// apps/api/src/__tests__/orders.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { buildApp } from '../app';
import { createTestClient, seedTestData } from '../test helpers';

describe('Orders', () => {
  let app: FastifyInstance;
  let client: TestClient;

  beforeEach(async () => {
    await seedTestData();
    app = await buildApp({ env: 'test' });
    client = createTestClient(app);
  });

  describe('POST /orders', () => {
    it('creates order with items', async () => {
      const { accessToken } = await loginTestUser(client);

      const response = await client.post('/orders')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          clientId: testData.client.id,
          items: [
            { productId: testData.products[0].id, qty: 10, price: 100 },
          ],
        });

      expect(response.status).toBe(201);
      expect(response.body.totalSum).toBe(1000);
    });

    it('validates inventory availability', async () => {
      // Test stock reservation logic
    });

    it('applies bonus rules', async () => {
      // Test bonus calculation
    });
  });
});
```

**4.2 Docker Configuration**

```yaml
# infra/docker/docker-compose.yml
version: '3.8'

services:
  api:
    build:
      context: ../../apps/api
      dockerfile: ../../infra/docker/api.Dockerfile
    ports:
      - "3001:3001"
    environment:
      DATABASE_URL: postgres://postgres:postgres@postgres:5432/salec
      REDIS_URL: redis://redis:6379
      JWT_SECRET: ${JWT_SECRET}
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  web:
    build:
      context: ../../apps/web
      dockerfile: ../../infra/docker/web.Dockerfile
    ports:
      - "3000:3000"
    environment:
      NEXT_PUBLIC_API_URL: http://api:3001

  postgres:
    image: postgres:16-alpine
    volumes:
      - pgdata:/var/lib/postgresql/data
    environment:
      POSTGRES_DB: salec
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redisdata:/data

volumes:
  pgdata:
  redisdata:
```

### 5. Migration Strategy

**Phase 1: Parallel Run**
```bash
# Yangi va eski tizim bir vaqtda ishlaydi
# Traffic: 10% yangi, 90% eski
```

**Phase 2: Gradual Migration**
```bash
# Module by module migration
# Migration order:
1. Auth & Tenant (foundation)
2. Clients
3. Products
4. Orders
5. Payments
6. Inventory
7. Reports
```

**Phase 3: Full Cutover**
```bash
# Eski tizim o'chiriladi
# 100% yangi tizim
```

### 6. Vaqt Rejasi

| Phase | Description | Duration |
|-------|-------------|----------|
| Phase 1 | Foundation (DB, Auth, Tenant) | 3 weeks |
| Phase 2 | Core Domain (Clients, Orders, Products) | 4 weeks |
| Phase 3 | Complex Domain (Payments, Inventory, Reports) | 4 weeks |
| Phase 4 | Frontend Implementation | 4 weeks |
| Phase 5 | Testing & Bug Fixes | 2 weeks |
| Phase 6 | Migration & Deployment | 1 week |
| **Total** | | **18 weeks (~4.5 months)** |

---

## Varyant B: Joriy Holatni Tuzatish

### 1. Prioritetli Yuklar

#### P0: Kritik Bug'larni Tuzarish

**1.1 RBAC Promise await**

```typescript
// modules/access/rbac.permissions.ts
// OLD: lines 39-48
missing.map(async (key) => {
  const permission = await getPermission(key, request);
  if (!permission) {
    missingPermissions.push(key);
  }
});

// NEW:
const permissions = await Promise.all(
  missing.map(key => getPermission(key, request))
);
missingPermissions = missing.filter((_, i) => !permissions[i]);
```

**1.2 Payment Transaction**

```typescript
// modules/payments/payment.balance.ts line 245
// OLD:
await prisma.$transaction(async (tx) => {
  await tx.payment.update(...);
});
await allocatePayment(...); // Not in transaction!

// NEW:
await prisma.$transaction(async (tx) => {
  const payment = await tx.payment.update(...);
  await tx.paymentAllocation.createMany({
    data: allocations.map(a => ({
      payment_id: payment.id,
      order_id: a.orderId,
      amount: a.amount,
    })),
  });
});
```

**1.3 Warehouse Transfer Transaction**

```typescript
// modules/stock/warehouse-transfers.lifecycle.ts
// Wrap entire transfer in single transaction:
await prisma.$transaction(async (tx) => {
  // 1. Validate stock availability
  // 2. Deduct from source
  // 3. Add to destination
  // 4. Create transfer record
  // 5. Create audit logs
});
```

#### P1: Performance Optimizatsiya

**2.1 N+1 Query Fix - Clients Detail**

```typescript
// modules/clients/clients.detail.ts
// OLD: Multiple sequential queries (lines 44-283)
// NEW: Single query with includes

const client = await prisma.client.findFirst({
  where: { id, tenant_id },
  include: {
    agent: { select: { id: true, name: true } },
    balances: true,
    auditLogs: {
      take: 10,
      orderBy: { created_at: 'desc' },
      include: { user: { select: { name: true } } }
    },
    assignments: {
      include: {
        agent: true,
        workSlot: true,
      }
    },
  }
});
```

**2.2 Add Database Indexes**

```sql
-- New indexes to add
CREATE INDEX idx_users_supervisor ON users(supervisor_user_id);
CREATE INDEX idx_products_active ON products(tenant_id) WHERE is_active = true;
CREATE INDEX idx_products_barcode ON products(tenant_id, barcode);
CREATE INDEX idx_orders_agent_status ON orders(tenant_id, agent_id, status);
CREATE INDEX idx_goods_receipts_supplier ON goods_receipts(tenant_id, supplier_id);
```

**2.3 Split Large Files**

**order.query.ts (337 lines) →**
```
modules/orders/
├── order.query.ts              # Main entry (50 lines)
├── order.query.builder.ts     # Query building (100 lines)
├── order.query.filters.ts     # Filter logic (80 lines)
├── order.query.pagination.ts   # Pagination (50 lines)
└── order.query Projection.ts   # Response mapping (57 lines)
```

**clients.import.main.ts (364 lines) →**
```
modules/clients/
├── clients.import.main.ts      # Orchestrator (50 lines)
├── clients.import.parser.ts   # XLSX parsing (100 lines)
├── clients.import.validator.ts # Validation (80 lines)
├── clients.import.batch.ts    # Batch processing (80 lines)
└── clients.import.reporter.ts # Progress reporting (54 lines)
```

#### P2: Medium Priority

**3.1 Rate Limiting**

```typescript
// app.ts - global rate limit
app.register(rateLimit, {
  global: true,
  max: 100, // 100 requests per minute
  timeMs: 60 * 1000,
  keyGenerator: (request) => {
    // Rate limit by tenant + user
    return `${request.tenant?.id}:${request.user?.id}`;
  },
  errorResponseBuilder: (request, context) => ({
    statusCode: 429,
    error: 'Too Many Requests',
    message: `Rate limit exceeded. Try again in ${Math.ceil(context.ttl / 1000)}s`,
  }),
});
```

**3.2 Redis Connection Pool**

```typescript
// lib/redis-cache.ts
import { Cluster } from 'ioredis';

const redis = new Cluster([
  { host: 'localhost', port: 7000 },
  { host: 'localhost', port: 7001 },
  { host: 'localhost', port: 7002 },
], {
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  scaleReads: 'slave',
  redisOptions: {
    maxRetriesPerRequest: 3,
    enableReadyCheck: true,
  },
});
```

**3.3 String to Enum Migration**

```prisma
// prisma/schema.prisma
// Add enums before models

enum OrderStatus {
  new
  confirmed
  assembling
  shipped
  delivered
  cancelled
  returned
}

enum UserRole {
  agent
  admin
  operator
  cashier
  supervisor
  expeditor
  gruzchik
}

enum PaymentKind {
  payment
  client_expense
}

model Order {
  status OrderStatus @default(new)
}

model User {
  role UserRole @default(agent)
}
```

#### P3: Future Improvements

**4.1 API Versioning**

```typescript
// app.ts
// OLD: /api/:slug/clients
// NEW: /api/v1/:slug/clients

app.register(async function registerV1Routes(app) {
  app.addHook('preHandler', async (request, reply) => {
    request.apiVersion = 'v1';
  });

  // Register all routes under /v1 prefix
  app.register(registerClientRoutes, { prefix: '/clients' });
}, { prefix: '/api/v1' });
```

**4.2 Security Headers**

```typescript
// app.ts
import helmet from '@fastify/helmet';

app.register(helmet, {
  contentSecurityPolicy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
  },
  referrerPolicy: 'strict-origin-when-cross-origin',
});
```

### 2. Migration Plan

| Phase | Task | Duration | Risk |
|-------|------|----------|------|
| 1 | Fix P0 bugs (RBAC, Payment, Transfer) | 1 week | Low |
| 2 | N+1 fixes + Indexes | 2 weeks | Medium |
| 3 | Split large files | 2 weeks | Medium |
| 4 | Rate limiting + Redis pool | 1 week | Low |
| 5 | Enum migration | 1 week | High |
| 6 | Testing + deployment | 1 week | Low |
| **Total** | | **8 weeks** | |

### 3. Estimated Cost

- Backend developer: 8 weeks × 40h = 320h
- Database migration: 1 week
- Testing: 1 week
- **Total estimated**: 10-12 weeks with team of 2

---

## Taqqoslash va Tavsiya

### Comparison Matrix

| Criteria | Varyant A (Rebuild) | Varyant B (Fix) |
|----------|---------------------|-----------------|
| **Vaxt** | 16-18 weeks | 8-10 weeks |
| **Xavf** | High (big change) | Low (incremental) |
| **Performance** | 3-5x improvement | 1.5-2x improvement |
| **Code Quality** | 10/10 (clean slate) | 6/10 (technical debt remains) |
| **Maintainability** | ★★★★★ | ★★★☆☆ |
| **Scalability** | ★★★★★ | ★★★☆☆ |
| **Cost** | $50,000-80,000 | $20,000-35,000 |
| **Team Required** | 3-4 developers | 1-2 developers |
| **Downtime Risk** | Medium | Low |
| **Long-term ROI** | Higher | Lower |

### Qachon Qaysi Varyantni Tanlash Kerak

**Varyant A tanlang agar:**
- [ ] Budget $50,000+
- [ ] 3+ oy vaqt bor
- [ ] Joriy texnologiya yetarli emas
- [ ] Kelajakda katta o'sish rejalashtirilgan
- [ ] Hozirgi code base ni to'liq o'zgartirish mumkin

**Varyant B tanlang agar:**
- [ ] Budget $30,000 dan kam
- [ ] 2 oydan kam vaqt
- [ ] Hozirgi tizim asosiy funksiyalarni bajaradi
- [ ] Tezkor natija kerak
- [ ] Team kichik (1-2 developer)

### Mening Tavsiyam

**SALEC loyha uchun Varyant A (0-dan qayta qurish) ni tavsiya qilaman**, quyidagi sabablarga ko'ra:

1. **Complexity**: 220,000 kod satri, 81 database jadval - bu murakkab tizimni incremental o'zgartirish xavfli
2. **Performance**: Hozirgi N+1 queries, katta fayllar, Prisma - 2-3x tezlik kerak
3. **Scalability**: Kelajakda 10x ko'proq data, yangi modulelar - yangi arxitektura kerak
4. **Maintainability**: 71 ta katta fayl, texnical debt - clean slate yaxshiroq
5. **Technology**: Drizzle, Next.js 15, Turborepo - 2-3 yil oldinda

**Lekin:** Agar sizda vaqt yoki budget cheklangan bo'lsa, Varyant B ni boshlash va keyin gradually migrate qilish ham mumkin.

---

## Xulosa

### Joriy Holat

SALEC - bu murakkab va functional tizim, lekin jiddiy muammolar bilan:

- 71 ta katta fayl (>200 lines)
- 213 ta $queryRaw usage
- N+1 query patterns
- 3 ta kritik bug
- String enums yo'q
- Rate limiting incomplete

### Ikkala Varyant

| | Varyant A | Varyant B |
|---|-----------|-----------|
| **Natija** | To'liq yangi, optimal tizim | Tuzatilgan eski tizim |
| **Vaxt** | 16-18 weeks | 8-10 weeks |
| **Quality** | Enterprise-grade | Production-ready |

### Keyingi Qadamlar

1. **Darhol**: P0 bug'larni tuzatish (RBAC, Payment, Transfer)
2. **1-2 hafta**: N+1 queries va indexlar qo'shish
3. **2-4 hafta**: Katta fayllarni bo'lish
4. **决策**: Varyant A yoki B ni tanlash
5. **Implementatsiya**: Tanlangan variantni amalga oshirish

---

## Appendix

### A. Fayl Ro'yxati

**Backend Critical Files (683 fayl):**
- modules/clients/ (66 fayl)
- modules/stock/ (77 fayl)
- modules/orders/ (37 fayl)
- modules/reports/ (28 fayl)
- modules/dashboard/ (24 fayl)
- modules/payments/ (28 fayl)
- modules/access/ (30+ fayl)

**Frontend Critical Files (482 fayl):**
- components/ (100+ components)
- app/(dashboard)/ (120+ pages)
- hooks/ (2 custom hooks)

### B. Dependencies

```json
{
  "backend": {
    "fastify": "^4.28.1",
    "@fastify/jwt": "^8.0.1",
    "@prisma/client": "^6.0.0",
    "bullmq": "^5.73.4",
    "ioredis": "^5.10.1",
    "zod": "^3.23.8"
  },
  "frontend": {
    "next": "14.2.35",
    "@tanstack/react-query": "^5.95.2",
    "zustand": "^5.0.12",
    "tailwindcss": "^3.4.1",
    "recharts": "^2.15.4"
  }
}
```

### C. Database Tables (81 ta)

1. Tenant, User, Role, Permission, UserRole, RolePermission
2. Client, ClientAgentAssignment, ClientBalance, ClientBalanceMovement
3. Product, ProductCategory, ProductBrand, ProductPrice
4. Order, OrderItem, OrderStatusLog, OrderChangeLog
5. Payment, PaymentAllocation
6. SalesReturn, SalesReturnLine
7. Stock, GoodsReceipt, GoodsReceiptLine
8. Warehouse, WarehouseBlock, WarehouseTransfer
9. BonusRule, BonusRuleCondition
10. WorkSlot, SlotUserLink, SlotAuditEntry
11. Territory, AgentVisit, AgentLocationPing
12. KpiGroup, KpiResult
13. ... (70+ more)

---

**Hujjat yaratildi:** 2026-yil 18-may  
**Version:** 1.0  
**Status:** Final