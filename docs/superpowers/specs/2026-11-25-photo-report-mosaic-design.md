# #8 Фотоотчёты — FlatReport polish + foto mosaika (A+)

**Date:** 2026-11-25  
**Status:** approved (user 2026-11-25); **amended** — asosiy ko‘rinish jadval (asl ustunlar); mosaika faqat bitta agent galereyasida (user 2026-11-25)  
**SalesDoc:** `/report/photoReport`  
**SALEC:** `/reports/photo`

## Intent / why

Отчёт parity #8: filtr/export chrome + **fotolarni ko‘rish** (mazayka/kartochka). Faqat matn jadvali yetarli emas — thumbnail + lightbox kerak.

## Goals

- Filtr chrome: `tablePrefsId`, `filterGridCols: 6`, dublikat filter-search olib tashlash (jadval qidiruvi qoladi).
- **Ikki ko‘rinish:** Jadval | Mosaika (default: Mosaika).
- Mosaika: thumbnail kartochkalar (foto, mijoz, sana, kategoriya, status); bosilsa lightbox.
- Jadval: birinchi ustunda kichik thumb (purged bo‘lsa placeholder).
- BE: har qatorda `thumb_url` (content proxy path, base64 emas); `content_purged` allaqachon bor.
- Content: mavjud supervisor/client photo content endpoint yoki reports uchun xavfsiz proxy (JWT).
- Seed: lokalda `total > 0` (mavjud `seed-photo-reports-test-once` yoki aksit uchun).
- Smoke + contract + sifat gate.

## Non-goals

- Supervisor Pro dashboardni ko‘chirish.
- Yangi foto yuklash/void UI (faqat hisobot).
- Commit/deploy so‘ralmaguncha.

## Anti-goals

- Ro‘yxat API da base64 image_url.
- Picker labeliga kod.

## Constraints

- ≤400 LOC / fayl; lint:errors; BE tsc; audit:max-loc.
- Доступ `reports.fotootchyoty` o‘zgartirilmaydi.
- Auth image: blob/JWT pattern (supervisor gallery kabi).

## Approaches

| | Variant | Trade-off |
|---|---------|-----------|
| A (eski) | Faqat FlatReport polish | Foto ko‘rinmaydi |
| **A+ (tanlangan)** | FlatReport filtrlar + dedicated workspace (jadval/mosaika) | Biroz ko‘proq FE; maqsadga mos |
| B | To‘liq gallery-only | Jadval/export parity zaiflashadi |

**Pick:** A+ (user 2026-11-25: A + mazayka/foto dizayn).

## How (builder)

1. BE: `thumb_url` = `/api/:slug/.../photo-reports/:id/content` (mavjud yoki reports-scoped).
2. FE: `PhotoReportWorkspace` — FlatReportFilters uslubidagi filtrlar yoki thin wrapper; view toggle; mosaic grid; table with thumb; lightbox reuse/adapt.
3. `page.tsx` → Workspace (FlatReportPage yolg‘iz emas).
4. Seed + smoke; parity plan #8 done.

## Left to builder

- Aniq content route (supervisor vs clients vs reports).
- Mosaic CSS (mavjud pro theme dan ixtiyoriy qayta ishlatish, lekin Отчёт sahifa uslubiga mos).
