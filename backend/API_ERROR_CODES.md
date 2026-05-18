# API Error Codes (Foundation)

Bu fayl backend va frontend uchun minimal umumiy xatolik kontraktini beradi.

**Bog‘liq:** marshrut tartibi va 403/404 talqini — `docs/rbac-route-pattern.md`; qatlam chegaralari — `docs/domain-boundary.md`; OpenAPI / breaking change — `docs/openapi-strategy.md`; minimal spec — `openapi/skeleton.yaml` (`npm run openapi:lint`).

## Backend–frontend JSON kontrakti (Sprint 0)

Har bir xato javobida (4xx/5xx, shu jumladan `sendApiError` va global error handler) quyidagi shaklga intizom:

```json
{
  "error": "ValidationError",
  "requestId": "req-123",
  "message": "Request validation failed",
  "details": {}
}
```

| Maydon | Majburiy | Izoh |
|--------|------------|------|
| `error` | ha | Mashina o‘qiydigan kod (`ValidationError`, `TenantNotFound`, …). |
| `requestId` | ha | `FastifyRequest.id` bilan bir xil; kuzatuv va support. |
| `message` | yo‘q | Inson uchun qisqa matn. |
| `details` | yo‘q | Validatsiya (`zodValidationExtras` → `flatten()`), RBAC (`permission`/`permissions`), boshqa strukturalangan qo‘shimcha. |

**Sarlavha:** har javobda `x-request-id` ham qo‘yiladi (`request-observability.plugin.ts`); qiymat odatda `requestId` bilan bir xil. Frontend `axios` javob sarlavhasidan ham o‘qishi mumkin.

## Umumiy javob formati (qisqa)

```json
{
  "error": "ValidationError",
  "requestId": "req-123",
  "message": "Request validation failed",
  "details": {}
}
```

## Eng ko‘p uchraydigan kodlar → HTTP status (amaliy jadval)

| HTTP | `error` | Qisqa izoh |
|------|---------|------------|
| 400 | `ValidationError` | Body/query/params Zod yoki domen validatsiyasi. |
| 400 | `InvalidId` | URL/body identifikator noto‘g‘ri. |
| 401 | `Unauthorized` | JWT yo‘q/yaroqsiz/muddati tugagan. |
| 401 | `INVALID_CREDENTIALS` | Login noto‘g‘ri. |
| 401 | `INVALID_REFRESH` | Refresh token yaroqsiz. |
| 403 | `ForbiddenRole` / `ForbiddenPermission` | RBAC rad etildi. |
| 403 | `ForbiddenEntitlement` | Skladchik entitlement. |
| 403 | `SESSION_LIMIT` | Sessiya limiti. |
| 403 | `CrossTenantDenied` | JWT `tenantId` va URL tenant mos emas. |
| 404 | `TenantNotFound` | Slug bo‘yicha tenant yo‘q yoki nofaol. |
| 404 | `TENANT_NOT_FOUND` | Login paytida tenant topilmadi (legacy string kod). |
| 404 | `NotFound` | Resurs tenant ichida topilmadi. |
| 429 | `TooManyRequests` | Rate limit. |
| 503 | `NotReady` | `/ready` tekshiruvi muvaffaqiyatsiz. |
| 500 | `InternalServerError` | Kutilmagan server xatosi. |

*To‘liq barcha kodlar barcha modullarda jadvalga sig‘maydi; yangi kod qo‘shganda shu jadvalni kengaytirish yetarli.*

## Asosiy error kodlar

- `ValidationError` — so‘rov body/query/params noto‘g‘ri.
- `InvalidId` — URL yoki body’dagi resurs identifikatori noto‘g‘ri.
- `InvalidAccessUser` — JWT ichidagi `sub` foydalanuvchi ID sifatida yaroqsiz.
- `UserNotFound` / `RoleNotFound` — tenant doirasida obyekt topilmadi.
- `SomeUsersNotFound` — massiv patch’da ba’zi `user_id` shu tenantda yo‘q.
- `ACCESS_MANAGE_REQUIRED` — `access.manage` yo‘q holda boshqa operatsiyalar yoki ombor delegatsiyasi berilmoqda.
- `SUPERVISEE_PATCH` — supervayzer ostidagi foydalanuvchilar patch’i domen qoidalariga mos kelmaydi.
- `ForbiddenRole` / `ForbiddenPermission` — RBAC (`auth.prehandlers.ts`).
- `Unauthorized` — JWT yaroqsiz yoki muddati tugagan.
- `TenantNotFound` — tenant slug topilmadi yoki tenant aktiv emas.
- `CrossTenantDenied` — JWT tenant va route tenant mos emas.
- `PayloadTooLarge` — upload hajmi limitdan katta.
- `TooManyRequests` — rate limit ishladi.
- `DatabaseSchemaMismatch` — migratsiya/schema nomosligi (`P2021`/`P2022`).
- `DatabaseValidationError` — Prisma validation xatosi.
- `InternalServerError` — kutilmagan server xatosi.

## Shared Zod (inkrement)

- `backend/src/contracts/auth.schemas.ts` — login/refresh tanalari (`auth.route.ts`).
- `backend/src/contracts/route-params.schemas.ts` — umumiy `:id` path (misol: `GET .../orders/:id`, `GET .../clients/:id`).
- `backend/src/contracts/orders.schemas.ts` — `POST .../orders` (`createOrderBodySchema`), `GET .../orders` query (`ordersListQuerySchema`).

## Frontend uchun tavsiya

- `requestId` ni har bir xatolik logida saqlash; `frontend/lib/api.ts` da `getRequestIdFromApiError`, `formatApiSupportReference`.
- `NEXT_PUBLIC_API_LOG_REQUEST_IDS=1` bo‘lsa, ishlab chiqarishda ham brauzer `console.warn` orqali `requestId` chiqadi (faqat diagnostika).
- `ValidationError.details` mavjud bo‘lsa form field xatolariga map qilish.
- `TenantNotFound` va `CrossTenantDenied` uchun alohida UX oqimi (tenant/session qayta tekshirish).
