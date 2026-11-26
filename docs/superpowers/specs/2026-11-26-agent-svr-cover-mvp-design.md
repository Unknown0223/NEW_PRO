# Wave 3 — Agent ↔ SVR cover (MVP A)

**Status:** approved (user 2026-11-26 — «A»)  
**Manba:** `2026-11-25-tezyuk-expeditor-app-design.md` Wave 3 + yondashuv A

## Maqsad

Agent kasal/yo‘q bo‘lsa, **faqat o‘z biriktirilgan SVR** uning marshrutini bajaradi. Oylikda agent chiqariladi, SVR agent tarkibida `SVR_COVER` bilan hisoblanadi.

## Qamrov (MVP A)

- Ikki tomonlama so‘rov: agent→SVR yoki SVR→agent; qabul + Face ID (ikkala tomon).
- `egasi_user_id=agent`, `bajaruvchi_user_id=SVR`.
- Bir agent uchun **kuniga bitta faol** cover.
- Mobil: SalesDoc flavor (`agent` / `supervisor` rollari) — TezYuk ekspeditoriga tegilmaydi.
- Tabel: agent «keldi» bo‘lsa **ogohlantirish** (default; taqiq flag keyin).
- Marshrut: SVR agent mijozlarini ko‘radi (mavjud agent API + cover context).

## Chiqarilgan (keyingi iteratsiya)

- Qisman qabul / orqaga qaytarish (ulashish pattern).
- Stitch pixel polish.
- Prod deploy (so‘ralmaguncha).

## Asosiy qoidalar

1. SVR faqat `users.supervisor_user_id = SVR` bo‘lgan agentlar uchun.
2. Faol cover paytida agent buyurtma/vizit yaratishi bloklanadi yoki cover orqali SVR JWT.
3. Payroll: cover kunlari agent exclude; SVR lines tagged `SVR_COVER`.
4. Audit: create/accept/end.

## Success

- Pure state + eligibility Vitest yashil.
- API: create/accept/list/active.
- Mobil: so‘rov yuborish/qabul + faol banner.
- Payroll exclude unit test.
