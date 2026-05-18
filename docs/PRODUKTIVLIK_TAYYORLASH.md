# Loyihani ishlab chiqarish va jamoa uchun “tayyor” holat

Bu hujjat [TOPSHIRIQ_1](./TOPSHIRIQ_1_JARAYON_NAVBATI.md)–[TOPSHIRIQ_3](./TOPSHIRIQ_3_STANDARTLASH_ROYXATI.md) bilan birga **kunlik ish**: jarayon tartibi, tekshiruv va UI standartlari uchun umumiy yo‘l.

---

## 1. Minimal tekshiruvlar (PR / commit oldidan)

Monorepo ildizidan (`SALES`/`SALEC` root):

| Buyruq | Ma’nosi |
|--------|---------|
| `npm run test:all:ci` | Backend `vitest run` + frontend `typecheck` + `lint` + `vitest` + Playwright **smoke** (CI dagi frontend gate bilan yaqin) |
| `npm test` | Backend + frontend **faqat** unit/integratsiya vitest (lintsiz) — tezroq |

Frontend alohida: `npm run test:quality` va `npm run test:e2e:smoke` (`frontend/` ichida).

Backend alohida: `npm run test:ci` (`backend/` ichida).

---

## 2. Ma’lumotlar bazasi va seed

- Yangi muhit: `npm run db:deploy` (yoki backend `prisma migrate deploy`), so‘ng `npm run db:seed` (ildizdan) yoki `npx prisma db seed` (`backend/`).
- **Integratsiya testlari** `test1` tenant, **SKU-001** mahsulot va **`agent` login** (rol `agent`, asosiy va filial omborlar bilan `warehouse_user_links`) foydalanuvchisini kutadi — `prisma/seed.ts` bularni yaratadi.
- Agar seed ishlamagan bo‘lsa, `backend/tests/db-global-setup.ts` marker `0` qiladi va DB integratsiya testlari **skip** bo‘ladi (noto‘g‘ri “yashirin” xatolardan saqlanish).
- Kod yangilangandan keyin: migratsiya + **qayta seed** — aks holda integratsiya testlari yoki UI agent bilan bog‘liq joylari eski DB bilan mos kelmasligi mumkin.

---

## 3. CI (GitHub Actions)

`.github/workflows/ci.yml`:

- **backend**: Postgres service, migrate, seed, `npm run test:ci`, `npm run build`.
- **frontend**: `npm run build`, Playwright Chromium, **`npm run test:all`** (= `test:quality` + `test:e2e:smoke`), `CI=true` bilan Next `start` orqali smoke.

---

## 4. Qo‘lda tekshiruv (TOPSHIRIQ 2)

Brauzerda ketma-ket checklist: [TOPSHIRIQ_2_LOYIHANI_TEKSHIRISH.md](./TOPSHIRIQ_2_LOYIHANI_TEKSHIRISH.md).

---

## 5. Standartlash bosqichi (TOPSHIRIQ 3)

Filtr/UI bir xilligi: avval modul tanlang (masalan faqat hisobotlar), [TOPSHIRIQ_3](./TOPSHIRIQ_3_STANDARTLASH_ROYXATI.md) dagi B-jadvaldan 2–3 band, keyin regressiya + smoke.

---

## 6. Samarasiz yuk sinovi (ixtiyoriy)

API ishga tushganida: `npm run load:smoke` — faqat ishlab turgan serverga qarshi; ildizdagi `npm run test:all` bunga bog‘langan (server yo‘q bo‘lsa natija xatolik ko‘rsatishi mumkin, lekin asosiy testlar alohida).
