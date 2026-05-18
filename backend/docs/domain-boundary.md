# Domain boundary (Sprint 1 — minimal konventsiya)

Maqsad: har modulda **qayerda tekshiruv**, **qayerda biznes qoida**, **qayerda DB** — bir xil kutilish.

## Qatlamlar (tavsif)

| Qatlam | Mas’uliyat | Joylashuv (odatda) |
|--------|------------|---------------------|
| **HTTP marshrut** | Method/path, `preHandler` (JWT, rol, ruxsat), handler boshida `ensureTenantContext`. | `*.route.ts` |
| **Kirish DTO** | Body/query/params Zod `safeParse` / `parse`; xato → `sendApiError` + `zodValidationExtras`. | `*.route.ts`, `contracts/*.schemas.ts` |
| **Servis** | Biznes qoidalar, tranzaksiya, bir nechta entity ustida ish. **Prisma chaqiruvlari** asosan shu yerda. | `*.service.ts` |
| **Persistence** | Murakkab so‘rovlar yoki qayta ishlatiladigan DB yordamchilari (ixtiyoriy). | `*.service.ts` ichida yoki alohida `*.repository.ts` (kerak bo‘lsa) |

## Qoidalar

1. **Route** faqat HTTP va autentifikatsiya/RBAC ni biladi; uzoq biznes mantiqni ko‘chirmang.
2. **Servis** `tenantId` ni parametr sifatida oladi (`request.tenant!.id` marshrutdan); servis ichida slug ishonmasin.
3. **Xato formati** — `sendApiError` (`backend/src/lib/api-error.ts`); kodlar — `API_ERROR_CODES.md`.

## Modul xaritasi (asosiy domain)

| Modul | Marshrut | Servis | Kontrakt (`contracts/`) | Eslama |
|-------|----------|--------|---------------------------|--------|
| Orders | `orders.route.ts` | `orders.service.ts` | `orders.schemas.ts` (POST, list, PATCH/bulk) | |
| Clients | `clients.route.ts` | `clients.service.ts` | `clients.schemas.ts` (PATCH) | Import multipart route da |
| Dashboard | `dashboard.route.ts` | `dashboard.service.ts` | filter parse servisda | `recordDashboardPerf` |
| Reports | `reports.route.ts` | `reports.service.ts` + report-builder + `order-debts-report.service.ts` | `reports.schemas.ts` | `reports.view` / `export` |
| Stock | `stock/*.route.ts` | `stock.service.ts` va boshqalar | `stock.schemas.ts` (balances query) | Servisda domain izoh |
| Products | `products.route.ts` | `products.service.ts` | `products.schemas.ts` (POST, PATCH, bulk, list query) | Servisda domain izoh |
| Payments | `payments.route.ts` | `payments.service.ts` | `payments.schemas.ts` (POST, PATCH, list query, batch) | Servisda domain izoh |
| Access | `access.route.ts` | `rbac.service.ts`, … | `auth.schemas.ts` (auth) | RBAC boshqaruvi |
| Linkage | `linkage.route.ts` | `linkage.service.ts` | — | Servisda domain izoh |
| Mobile | `mobile.route.ts` | `mobile.service.ts` | — | Agent maydoni |

Marshrut audit: `route-audit-clients-reports.md`, `route-audit-core-modules.md`; CI: `npm run audit:route-tenant`.

## Keyingi inkrement

- Modul-modul katta servislarni bo‘lish — alohida PR lar bilan.
- Tashqi kontrakt artefakti: `openapi-strategy.md`.
- Release oldidan performance: `performance-release-checklist.md`.
