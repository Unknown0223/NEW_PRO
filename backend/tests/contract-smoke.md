# API contract smoke list (CI uchun maqsad)

Maqsad: regressiya va kontrakt drift uchun **kamida** quyidagi yo‘llarni keyinchalik avtomatlashtiriladigan yoki qo‘lda smoke sifatida tekshirish. Javobda `error` + `requestId` (+ ixtiyoriy `message`/`details`) va sarlavhada `x-request-id` kutiladi.

**Avtomatlashtirilgan (CI):** `tests/contract-smoke.integration.test.ts` — #1–4, noto‘g‘ri tenant (#15), login validatsiya, refresh yaroqsiz, `/me`, orders/clients 404, dashboard stats, `access/me-permissions` (seed `test1`); **RBAC:** admin `GET /reports/sales` 200, `GET /reports/order-debts` 200; **Reports validation:** `GET /reports/cash-flow`, `GET /reports/income-report` (query yo‘q) → `ValidationError`; agent `ForbiddenRole` / `ForbiddenPermission`, `CrossTenantDenied`; **Validation:** `POST /orders`, `POST /payments`, `POST /products`, `PATCH /clients/:id`, `PATCH /orders/:id/status` → `ValidationError`.

| # | Method | Path | Minimal muvaffaqiyat / eslatma |
|---|--------|------|--------------------------------|
| 1 | `POST` | `/auth/login` yoki `/api/auth/login` | 200 yoki 401/404 (xato tanada kontrakt) | ✅ `contract-smoke.integration.test.ts` |
| 2 | `POST` | `/auth/refresh` | 401 `INVALID_REFRESH` yoki 200 | ✅ yaroqsiz token |
| 3 | `GET` | `/ready` | 200 yoki 503 `NotReady` | ✅ |
| 4 | `GET` | `/health` | 200 | ✅ |
| 5 | `GET` | `/api/:slug/clients/:id` | 200 yoki 404 `NotFound` (tenant + JWT) | ✅ 404 |
| 6 | `GET` | `/api/:slug/orders/:id` | 200 yoki 404 | ✅ 404 NotFound (yaroqsiz id) |
| 7 | `GET` | `/api/:slug/orders` | 200 (list, query params bilan) | ✅ |
| 8 | `POST` | `/api/:slug/orders` | 400 `ValidationError` yoki 201 (kontrakt tekshiruvi) | ✅ yaroqsiz body |
| 8b | `PATCH` | `/api/:slug/clients/:id` | 400 `ValidationError` (bo‘sh body) | ✅ |
| 9 | `GET` | `/api/:slug/stock/balances` | 200 (qoldiqlar; og‘ir so‘rov — slow-query inventory) | ✅ |
| 10 | `GET` | `/api/auth/me` | 200 (JWT bilan) | ✅ |
| 11 | `GET` | `/api/:slug/products` | 200 | ✅ |
| 12 | `PATCH` | `/api/:slug/settings/profile` | 403/200 yoki 400 `ValidationError` (bo‘sh body) | ✅ admin ValidationError |
| 13 | `GET` | `/api/:slug/access/me-permissions` | 200 (JWT bilan) | ✅ |
| 14 | `GET` | `/api/:slug/dashboard/stats` | 200 (`dashboard.view` yoki mos ruxsat) | ✅ |
| 15 | `GET` | noto‘g‘ri tenant slug | 404 `TenantNotFound` | ✅ |

*`:slug` o‘rniga test tenant slug; barcha so‘rovlarda haqiqiy yoki test JWT.*
