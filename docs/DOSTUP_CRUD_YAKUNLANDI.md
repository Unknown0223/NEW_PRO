# ✅ Dostup (ruxsatlar CRUD) — yakunlandi

**Sana:** 2026-06-26

## Tekshiruv

```powershell
cd backend
npm run dostup:verify
```

| Test to‘plami | Natija |
|---------------|--------|
| `route-permission-guard.pure.test.ts` | ✅ qoidalar mapping |
| `rbac.permissions.pure.test.ts` | ✅ |
| `access-api.integration.test.ts` | ✅ 6/6 (katalog CRUD action) |
| `rbac-enforcement.integration.test.ts` | ✅ 4/4 (`RBAC_ENFORCE_PERMISSIONS=1`) |
| `contract-smoke.integration.rbac.test.ts` | ✅ 17/17 |

**Jami:** 35/35 test

## Migratsiya

```powershell
npm run rbac:migrate-crud          # test1 tenant
npm run rbac:migrate-crud -- --all # barcha tenantlar
```

`db:seed` endi avtomatik `rbac:migrate-crud` ni ham ishga tushiradi.

## Production

`.env` da (staging/prod):

```
RBAC_ENFORCE_PERMISSIONS=1
```

Default `0` — mavjud foydalanuvchilar 403 olmasligi uchun. Migratsiya + seed dan keyin yoqing.

## Asosiy fayllar

| Fayl | Vazifa |
|------|--------|
| `src/modules/access/route-permission-guard.ts` | Markazlashgan route → permission |
| `src/modules/access/permission-catalog.ts` | CRUD katalog |
| `scripts/migrate-permissions-to-crud.ts` | Legacy → strukturali kalit |
| `frontend/lib/use-permissions.ts` | `has()` / `hasAny()` |
| `frontend/components/access/can.tsx` | `<Can permission="...">` |
| `frontend/components/access/access-role-defaults-workspace.tsx` | CRUD grid UI |
