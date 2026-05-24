# RBAC va tenant — marshrut naqshi (Sprint 2)

Maqsad: himoyalangan `/api/:slug/...` endpointlari uchun **bir xil ketma-ketlik** va yangi marshrut qo‘shganda tekshiruv ro‘yxati.

## Tavsiya etilgan tartib

1. **`jwtAccessVerify`** — JWT mavjud va yaroqli. Har doim birinchi.
2. **`requireRoles(...)`** — foydalanuvchi roli ruxsat etilgan ro‘yxatda (ixtiyoriy, lekin ko‘p veb marshrutlarda kerak).
3. **`requirePermission` / `requireAnyPermission`** — RBAC kalitlari. Legacy kalitlar bilan bir vaqtda ishlatish uchun `requireAnyPermission([ "orders.view", "orders.zakaz.spisok_zakazov", ... ])` naqshi (`linkage.route.ts`).

**Handlerning birinchi qatorlari:**

4. **`if (!ensureTenantContext(request, reply)) return;`** — URL slug orqali yuklangan `request.tenant` JWT `tenantId` bilan mos kelishi. Tenant-aware DB dan oldin **majburiy**.

5. **Servis chaqiruvi** — `request.tenant!.id` ni `tenantId` sifatida uzating.

`preHandler` massivida tartib: `[ jwtAccessVerify, requireRoles(...), requireAnyPermission([...]) ]`, so‘ng handler ichida `ensureTenantContext`. `ensureTenantContext` ni `preHandler` ga ko‘chirish mumkin, lekin hozirgi kod bazasida handler boshidagi chaqiruv — standart.

## Legacy ruxsat → yangi RBAC (bitta amaliy manba)

- **Katalog va matnlar:** `permission-catalog` + `LEGACY_PERMISSION_METADATA` (`legacy-permissions.generated.ts`, `parse-legacy-permissions.mjs` orqali yangilanadi).
- **Endpoint:** yangi kalit + legacy kalitlarni **bir `requireAnyPermission` ro‘yxatida** sanash — rollout paytida ikkala tizim ham ishlayveradi.

## 403 va 404 (xavfsizlik va UI)

| HTTP | `error` | Ma’nosi |
|------|---------|---------|
| 404 | `TenantNotFound` | Slug bo‘yicha tenant yo‘q yoki nofaol. Odatda login/konfig noto‘g‘ri. |
| 403 | `CrossTenantDenied` | JWT boshqa tenantga tegishli, URL esa boshqa tenant. Atakka / noto‘g‘ri sessiya. |
| 403 | `ForbiddenRole` / `ForbiddenPermission` | Tenant to‘g‘ri, lekin ruxsat yo‘q. |
| 404 | `NotFound` | Tenant ichida resurs yo‘q. |

Batafsil jadval: `API_ERROR_CODES.md`. Frontend: `TenantNotFound` / `CrossTenantDenied` uchun sessiya tozalash — `frontend/lib/api.ts` interceptor.

## Yangi endpoint checklist (RBAC + tenant)

Marshrut qo‘shilganda quyidagilarni tekshiring:

- [ ] URL `/api/:slug/...` ostida — `tenant` plugin ishlaydimi?
- [ ] JWT kerak bo‘lsa — `jwtAccessVerify` `preHandler` da bormi?
- [ ] Rol chegarasi kerakmi — `requireRoles`?
- [ ] Aniq operatsiya uchun `requirePermission` yoki `requireAnyPermission` (kerak bo‘lsa legacy kalitlar bilan)?
- [ ] Handler boshida `ensureTenantContext` bormi (tenant-aware yozuv/o‘qishdan oldin)?
- [ ] Integratsiya yoki birlik testida: to‘g‘ri ruxsat — 2xx; ruxsatsiz — 403; noto‘g‘ri slug — 404; boshqa tenant JWT — 403 `CrossTenantDenied`.

Qisqa checklist nusxasi: `.cursor/plans/foundation_tenant_context_audit.md`.

## Bog‘liq

- Tashqi API artefakti strategiyasi: `openapi-strategy.md`.
