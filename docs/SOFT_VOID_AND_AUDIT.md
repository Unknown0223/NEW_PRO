# Soft-void va audit standarti

Ichki siyosat: qaytarib bo‘lmaydigan hard delete o‘rniga soft-void / deactivate, va har bir mutate uchun tarix.

## Standart

| Tur | Pattern | HTTP | Audit |
|-----|---------|------|-------|
| Hujjat / operatsion | `deleted_at` + `deleted_by_user_id` (+ ixtiyoriy `delete_reason_ref`) | `DELETE` = void; `POST …/restore` | `{entity}.void` / `{entity}.restore` |
| Katalog / staff | `is_active=false` | deactivate / activate | `{entity}.deactivate` / `.activate` |
| Supplier payment | `reversed_at` storno | reverse endpoint | `supplier_payment.reverse` |
| Hard delete | Faqat empty + superadmin ops | ops script | `ops.purge` |

Shared helper: [`backend/src/lib/soft-void.ts`](../backend/src/lib/soft-void.ts)

RBAC: `*.void` / `*.restore` — [`permission-model.ts`](../backend/src/modules/access/permission-model.ts)

UI: [`SoftVoidConfirmDialog`](../frontend/components/shared/soft-void-confirm-dialog.tsx); moliyada sabab majburiy.

## Feature flag

| Env | Default | Ma’no |
|-----|---------|-------|
| `SOFT_VOID_V1` (backend) | `1` | Rollout bayrog‘i. **Backend soft-void har doim ishlaydi** — `0` hard delete ni qayta yoqmaydi. |
| `NEXT_PUBLIC_SOFT_VOID_V1` (frontend) | yoqilgan | `0` / `false` — arxiv toggle / restore UI yashiriladi (`isSoftVoidUiEnabled()`). |

Yangi o‘rnatishlarda default ON. Staging/prod da UI ni vaqtincha yashirish uchun juftlik:

```bash
SOFT_VOID_V1=0
NEXT_PUBLIC_SOFT_VOID_V1=0
```

## Coverage matrix (inventar)

| Modul | Route / service | Cascade / yon-ta’sir | Soft? | Audit | Bosqich |
|-------|-----------------|----------------------|-------|-------|---------|
| Payment | `payment.balance.void` | balance reverse; alloc wipe→snapshot | Soft | TenantAudit (+ ClientAudit) | 0/1/2 |
| Expense | `expenses.lifecycle` | draft only | Soft | TenantAudit | 0 |
| Goods receipt draft | `goods-receipt.lifecycle` | — | Soft | TenantAudit | 0 |
| Goods receipt posted cancel | status→cancelled | stock reverse majburiy | Soft+stock | TenantAudit | 2 |
| Territory | `territory.crud` | — | Soft | TenantAudit | 0 |
| Opening balance | `opening-balances.write` | balance | Soft | ClientAudit | 0 |
| Product | `products.crud` | — | `is_active` | TenantAudit | 0 |
| Order create/status/cancel | `order.lifecycle` | status log | n/a | TenantAudit | 1 |
| Order status rollback | prune→`superseded_at` | — | Soft log | domain log | 1 |
| Client import | `clients.import.*` | create/update | n/a | ClientAudit | 1 |
| Tags / agent assign | `clients.tags` | replace | n/a | ClientAudit | 1 |
| Photo report | `client-assets.service` | file keep 60d then purge content | Soft + content purge | Tenant+Client | 1/2 |
| Equipment remove | already soft | — | Soft | audit | 1 |
| Work slots | `work-slots.service` | bulk | Soft | TenantAudit | 1/3 |
| Geo boundaries | `geo-boundaries.service` | JSON store | Soft flag | TenantAudit | 1/3 |
| Report builder / plans | saved configs | — | Soft | TenantAudit | 1/3 |
| Access reset | `access.route.users-write` | grants wipe→snapshot | Soft snapshot | AccessLog+Tenant | 1/2 |
| Brand / manufacturer / segment / group / category | catalog CRUD | unique code | `is_active` | TenantAudit | 3 |
| Warehouse / block | reference CRUD | empty check | Soft / `is_active` | TenantAudit | 3 |
| Automation rules | `order-automation.crud` | — | Soft | TenantAudit | 3 |
| FX rates | `currency-exchange-rates` | — | Soft | TenantAudit | 3 |
| Supplier | `suppliers.service` | docs yo‘q | `is_active` | TenantAudit | 3 |
| Client merge | `clients.merge` | reassign | undo yoki ogohlantirish | full audit | 2 |
| Inventory take | `stock-takes.service` | qty overwrite | snapshot lines | TenantAudit | 2 |
| Activity / audit stores | retention cron | purge | n/a | ops.purge | 4 |

**Legenda:** Soft = `deleted_at`; `is_active` = deactivate; n/a = soft emas, faqat audit.

## Error kodlari

| Kod | Ma’no |
|-----|--------|
| `NOT_FOUND` | Topilmadi |
| `ALREADY_VOIDED` | Allaqachon arxivda |
| `NOT_VOIDED` | Arxivda emas (restore) |
| `RESTORE_COMMENT_REQUIRED` | Moliyaviy restore izohi |
| `REASON_REQUIRED` | Sabab majburiy |
| `CANNOT_VOID` / `CANNOT_RESTORE` | Biznes qoida |

## Ro‘yxat filtri

`?archive=true` — faqat void qatorlar; default — faqat aktiv (`deleted_at IS NULL`).

## Retention (Bosqich 4)

| Store | Default |
|-------|---------|
| `tenant_audit_events` | 730 kun (`AUDIT_RETENTION_DAYS` yoki `settings.audit_retention_days`) |
| `client_audit_logs` | 730 |
| `access_logs` | 730 |
| `order_status_logs` / `order_change_logs` | 730 |
| `slot_audit_entries` | 730 |
| `client_merge_logs` | 730 (tenant override mumkin) |
| Activity (`user_activity_events`) | 90 kun (`ACTIVITY_RETENTION_DAYS`) |
| Fotootchet **fayl** (`image_url`) | 60 kun (`PHOTO_CONTENT_RETENTION_DAYS`) — qator/son qoladi, rasm tozalanadi |

**Cron (asosiy):** backend ishga tushganda `enableAuditRetentionCron()` — har 24 soatda `runAuditRetentionPurge()`.

**Qo‘lda:** `cd backend && npm run audit:retention`

**Excel eksport:** `GET /api/:slug/audit-events?export=xlsx` yoki `/api/:slug/audit-events/export.xlsx`

## Ops skriptlar

`db-truncate-all-once`, `reset-clients-once`: ikki bosqichli confirm + `--backup-ok` + audit `ops.purge`.

```bash
CONFIRM_TRUNCATE=YES npx tsx scripts/db-truncate-all-once.ts --confirm-phrase=DELETE_ALL_DATA --backup-ok
CONFIRM_TRUNCATE=YES IMPORT_TENANT_SLUG=test1 npm run reset:clients-once -- --confirm-phrase=DELETE_ALL_DATA --backup-ok
```

## Rollout (Bosqich 6)

1. **Backup DB** (prod/staging snapshot yoki `pg_dump`).
2. `cd backend && npm run db:deploy` — soft-void migratsiyalar.
3. `npx prisma generate` (yoki `npm run db:generate`).
4. Backend + frontend deploy.
5. **Smoke:** to‘lov void → restore; brand deactivate → restore; `/settings/audit` da `payment.void` / `soft_delete` ko‘rinadi.
6. Retention cron allaqachon `enableAuditRetentionCron()` orqali ulangan — logda purge ni tekshirish.
7. Ixtiyoriy: `SOFT_VOID_V1=1` + `NEXT_PUBLIC_SOFT_VOID_V1=1` (default ON).

**Testlar:**

```bash
cd backend
# Unit (DB kerak emas)
npx vitest run tests/soft-void.unit.test.ts

# Integration (marker `.db-integration-ready` = `1`)
npx vitest run tests/soft-void.integration.test.ts
```

## Yakun

Bosqichlar 0–6 qisqacha: [`SOFT_VOID_AUDIT_YAKUNLANDI.md`](./SOFT_VOID_AUDIT_YAKUNLANDI.md).
