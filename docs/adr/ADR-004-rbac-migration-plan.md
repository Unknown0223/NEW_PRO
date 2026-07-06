# ADR-004: Legacy RBAC → strukturali CRUD migratsiya rejasi

**Status:** Accepted (R-03 infra: deprecation + ADR yangilandi; prod migratsiya alohida)  
**Date:** 2026-07-06

## Context

SALEC da ikki parallel ruxsat modeli mavjud:

1. **Legacy** — tekis kalitlar (`clients.spisok_klientov`, `orders.zakaz.sozdanie_zakaza`, …) `tools/legacy_permissions_raw.txt` va tenant DB `role_permissions` jadvalida.
2. **Strukturali CRUD** — `<module>.<section>.<action>` (`clients.klient.view`, `orders.zakaz.create`, …) `permission-model.ts` katalogida.

`legacy-key-map.ts` eski kalitlarni yangi kalitlarga moslashtiradi. `npm run rbac:migrate-legacy` (alias: `migrate-permissions-to-crud.ts`) **non-destructive** migratsiya — eski kalitlar saqlanadi, yangilari qo‘shiladi.

## Decision

### Migratsiya bosqichlari

| Bosqich | Harakat | Holat |
|---------|---------|-------|
| M1 | `legacy-key-map.ts` audit — `EXPLICIT_MAP` + `SECTION_ALIAS` to‘liqligi | ✅ Joriy |
| M2 | Har bir tenant uchun `npm run rbac:migrate-legacy <slug>` | Dev/staging da bajariladi |
| M3 | `RBAC_ENFORCE_PERMISSIONS=1` production pilot tenant | Keyingi release |
| M4 | Legacy kalitlarni DB dan olib tashlash | **M3 dan 2 hafta keyin**, faqat audit tasdiqlangach |

### Legacy fayllarni o‘chirish shartlari

Quyidagilar bajarilgunga qadar legacy fayllar **o‘chirilmaydi**:

- [ ] Barcha production tenantlarda `rbac:migrate-legacy` muvaffaqiyatli
- [ ] `route-permission-guard.ts` barcha marshrutlarni qamrab olgan (`npm run dostup:verify`)
- [ ] `RBAC_ENFORCE_PERMISSIONS=1` kamida 7 kun xatosiz ishlagan
- [ ] `legacy-key-map.ts` dagi barcha `EXPLICIT_MAP` kalitlari testda (`permission-crud-model.pure.test.ts`)

### Saqlanadigan fayllar (hozircha)

| Fayl | Sabab |
|------|-------|
| `legacy-key-map.ts` | Migratsiya va audit |
| `tools/legacy_permissions_raw.txt` | Referens ro‘yxat |
| `scripts/migrate-permissions-to-crud.ts` | Migratsiya skripti |
| `legacy-permissions.generated.ts` | Deprecated — M4 gacha saqlanadi |

## R-03 alignment (2026-07-06)

### Status: In Progress → Completed (qisman)

### Bajarildi

- [x] `migrate-permissions-to-crud.ts` skripti yozildi
- [x] `legacy-key-map.ts` to'liq mapping
- [x] `legacy-permissions.generated.ts` ga `@deprecated` JSDoc qo'shildi
- [ ] `--all` flag bilan barcha tenant'larda ishlatildi: prod deploy alohida
- [ ] `legacy-permissions.generated.ts` o'chiriladi: keyingi sprint (M4 shartlari bajarilgach)

## Audit natijasi (2026-07-06)

`legacy-key-map.ts`:

- `ACTION_PATTERNS` — 11 naqsh (view/create/update/delete/import/copy/…)
- `SECTION_ALIAS` — orders, clients, cash, warehouse, staff, plans, … modullar
- `EXPLICIT_MAP` — dashboard, orders, clients, suppliers, cash, gps, `access.manage`
- `mapLegacyKeyToStructured` — noma'lum kalit uchun `null` (legacy saqlanadi)

Tekshiruv: `tests/permission-crud-model.pure.test.ts` — legacy-key-map bo‘limi.

## Consequences

- Yangi marshrutlar faqat strukturali kalit bilan (`route-permission-guard.ts`)
- Legacy kalitlar yangi featurelarda ishlatilmaydi
- M4 dan keyin `legacy_permissions_raw.txt` arxivga ko‘chiriladi

## Alternatives considered

- **Big-bang legacy o‘chirish** — production riski yuqori, rad etildi
- **Ikki modelni doimiy saqlash** — audit murakkabligi, faqat M4 gacha vaqtinchalik
