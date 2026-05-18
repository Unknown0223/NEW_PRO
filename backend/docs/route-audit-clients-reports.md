# Marshrut audit: `clients` va `reports` (P1 #8)

**Sana:** 2026-05-15  
**Naqsh:** `backend/docs/rbac-route-pattern.md`

## Xulosa

| Modul | Marshrutlar | `ensureTenantContext` | RBAC `preHandler` | Izoh |
|-------|-------------|------------------------|-------------------|------|
| `clients.route.ts` | 36 | 36/36 (import/template tuzatildi) | Ko‘p marshrutlar `requireRoles(...catalogRoles)`; ro‘yxat/detail — faqat `jwtAccessVerify` | Agent/mobil ro‘yxat uchun JWT yetarli; yozuvlar `catalogRoles` |
| `reports.route.ts` | 51 | 51/51 (4 ta marshrut 2 ta umumiy handler) | `reports.view` / `reports.export`; daromad — `cashbox.income_report.*` | Namuna modul |

Tekshiruv: `node scripts/audit-route-tenant-context.mjs`

## `clients.route.ts`

- **Tenant:** barcha handlerlarda `ensureTenantContext` (2026-05-15: `GET .../import/template` qo‘shildi — shablon tenant-agnostik bo‘lsa ham `CrossTenantDenied` tekshiruvi).
- **JWT:** barcha marshrutlarda `jwtAccessVerify`.
- **Rol:** import/merge/dedupe/admin — `ADMIN_AND_OPERATOR_LIKE_ROLES`; `GET /clients`, `GET /clients/:id`, references, analytics — faqat JWT (servis tenant scope bilan filtrlaydi).
- **Ruxsat kaliti:** alohida `requirePermission` yo‘q — legacy rol modeli; keyingi bosqichda `clients.view` kabi RBAC kalitlari qo‘shilishi mumkin.

## `reports.route.ts`

- **Tenant:** har bir handler (yoki `receivablesExportHandler` / `receivablesListHandler`) boshida `ensureTenantContext`.
- **JWT + ruxsat:**
  - `reportViewPreHandler` = `jwtAccessVerify` + `requirePermission("reports.view")`
  - `reportExportPreHandler` = `jwtAccessVerify` + `requirePermission("reports.export")`
  - Daromad hisoboti = `requireAnyPermission` (cashbox + reports fallback)

## Regressiya (CI)

`tests/contract-smoke.integration.test.ts` — `ForbiddenPermission`, `CrossTenantDenied`, admin `GET /reports/sales` 200.

## Keyingi audit

Boshqa og‘ir modullar: `orders.route.ts`, `stock.route.ts`, `dashboard.route.ts`.
