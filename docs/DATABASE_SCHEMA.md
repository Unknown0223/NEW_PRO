# SALEC — Database Schema

> **Maqsad:** Prisma sxemasini hujjatlashtirish (merge qilinmaydi — multi-file tuzilma saqlanadi).  
> **Manba:** `backend/prisma/schema.prisma`, `backend/prisma/models/group-*.prisma`, `backend/prisma.config.ts`

## Tuzilma

```
backend/prisma/
├── schema.prisma          # generator + datasource (URL: DATABASE_URL)
├── models/
│   ├── group-01.prisma    # Tenant, User, Product, DeviceToken, …
│   ├── group-02.prisma    # Client, ProductPrice, ClientPhotoReport, …
│   ├── group-03.prisma    # Warehouse, Stock, ClientBalance, WorkSlot, …
│   ├── group-04.prisma    # Order, Payment, SalesReturn, GoodsReceipt, …
│   ├── group-05.prisma    # BonusRule, CashDesk, AgentVisit, …
│   ├── group-06.prisma    # RBAC (Role, Permission), Territory, Expense, …
│   ├── group-07.prisma    # OrderRestrictionRule, OrderAutoConfirmRule, …
│   └── group-08.prisma    # PlanApprover, SalesKpiPlan, …
└── migrations/            # SQL migratsiyalar (deploy: npm run db:deploy)
```

`prisma.config.ts` — CLI uchun `schema: prisma/`, `migrations.path`, seed (`tsx prisma/seed.ts`).

## Domain guruhlari (qisqa)

| Guruh | Asosiy modellar | Biznes soha |
|-------|-----------------|-------------|
| **01** | `Tenant`, `User`, `Product`, `ProductCategory`, `RefreshToken`, `DeviceToken` | Multi-tenant, auth, katalog |
| **02** | `Client`, `ProductPrice`, `ClientEquipment`, `ClientPhotoReport`, `ClientAgentAssignment` | Mijozlar, narxlar, foto |
| **03** | `Warehouse`, `Stock`, `ClientBalance`, `WorkSlot`, `Supplier` | Ombor, balans, ish slotlari |
| **04** | `Order`, `OrderItem`, `Payment`, `SalesReturn`, `GoodsReceipt` | Zakazlar, to‘lovlar, qaytarish |
| **05** | `BonusRule`, `CashDesk`, `AgentVisit`, `PriceMatrix`, `InAppNotification` | Bonus, kassa, marshrut |
| **06** | `Role`, `Permission`, `Territory`, `Expense`, `AccessLog` | RBAC, hudud, xarajat |
| **07** | `OrderRestrictionRule`, `OrderAutoConfirmRule` | Zakaz avtomatlashtirish |
| **08** | `PlanApproverConfig`, `SalesKpiPlan` | Reja / KPI / tasdiqlash |

## Muhim bog‘lanishlar

- Har bir biznes jadvali `tenant_id` bilan tenant-scope.
- `Client` → `agent_id` + `ClientAgentAssignment` (ko‘p slot).
- `Order` → `client_id`, `warehouse_id`, `agent_id`, `items`.
- RBAC: `User` ↔ `UserRole` ↔ `Role` ↔ `RolePermission` ↔ `Permission` (+ `UserPermission` override).

## Tekshiruv

```bash
cd backend
npx prisma validate
npx prisma format
npm run db:deploy    # migratsiyalarni qo‘llash
```

## Yangi ustun / jadval qo‘shish

1. Tegishli `group-NN.prisma` faylini tahrirlang (bitta fayl 400 satrdan oshmasligi maqsad — yangi guruh yoki bo‘linish).
2. `npx prisma migrate dev --name <nom>` yoki production uchun `migrate deploy`.
3. Ushbu hujjatdagi jadvalni yangilang.
