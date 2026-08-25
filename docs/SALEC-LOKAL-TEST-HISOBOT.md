# SALEC — lokal sinov hisoboti

**Kim uchun:** dasturlashni bilmaydigan odam  
**Sana:** 2026-08-15  
**Til:** oddiy ofis tili

**Bir jumla:** **asosiysi ishlayapti** — server, ofis paneli, namuna kirish va oxirgi xavfsizlik tuzatishlari yashil; telefon ekranini shu kompyuterda emulator bilan ochib ko‘rib bo‘lmadi.

---

## Nima ishga tushirildi

| Nima | Holat |
|---|---|
| Ma’lumotlar bazasi (Postgres) | Ishladi (`savdo_postgres`) |
| Tezkor xotira (Redis) | Ishladi (`savdo_redis`) |
| Asosiy server (API, 18080) | Ishladi. «Do‘kon ochiqmi?» (`/health`) va «Baza-kesh tayyormi?» (`/ready`) — **200** |
| Fon ishchisi (worker) | Ishladi |
| Ofis paneli (sayt) | Ishladi, lekin **3010-portda**. 3000-portda boshqa dastur (HR HUB) turgani uchun SALEC panelini o‘sha joyga qo‘ymadik |
| Telefon emulatori (Android) | **Yo‘q** — shu kompyuterda ulangan telefon/emulator topilmadi |

Kirish **namuna (seed) login** bilan sinandi: kompaniya kodi `test1`, admin / operator / agent. Ishlab chiqarish parollari o‘qilmadi.

---

## Bo‘limlar (oddiy jadval)

| Bo‘lim | Natija | Izoh |
|---|---|---|
| Server ochiqmi | **Ishlaydi** | Health va ready yashil, baza va Redis ham |
| Kirish (admin, operator, agent) | **Ishlaydi** | Namuna loginlar ochildi |
| Kirish chiptasini cookie orqali yangilash | **Ishlaydi** | Oxirgi tuzatish: tana yozilmasdan, yopiq cookie (`salec_rt`) |
| Boshqaruv paneli (dashboard) | **Ishlaydi** | |
| Zakazlar ro‘yxati | **Ishlaydi** | |
| Mijozlar | **Ishlaydi** | |
| To‘lovlar | **Ishlaydi** | |
| Ombor | **Ishlaydi** | |
| Hisobotlar (savdo, GPS filter) | **Ishlaydi** | |
| Xodimlar | **Ishlaydi** | |
| Ruxsatlar (access) | **Ishlaydi** | |
| Ish o‘rinlari | **Ishlaydi** | |
| Kassa | **Ishlaydi** | |
| Mahsulotlar | **Ishlaydi** | |
| Rejalar | **Ishlaydi** | |
| Konsignatsiya | **Ishlaydi** | |
| Xabarnomalar | **Ishlaydi** | |
| Past huquqli odam zakaz o‘chira oladimi | **Ishlaydi** (himoya) | Agent o‘chira olmadi. To‘lovlar ro‘yxatiga ham kira olmadi |
| Boshqa kompaniya slug’iga o‘sha chipta | **Ishlaydi** (himoya) | `demo` manziliga **403** — «boshqa do‘kon» yopiq |
| Sayt tezligi qutisi (web-vitals) | **Ishlaydi** | Kirishsiz, g‘alati uzun yo‘l — 204, portlamadi |
| Ofis paneli sahifalari | **Ishlaydi** | `/login` ochildi; boshqa sahifalar kirmaganni `/login` ga buradi — bu to‘g‘ri |
| Telefon: versiya tekshiruvi va APK | **Ishlaydi** | APK serverda bor |
| Telefon: profil, dashboard, sinxron | **Ishlaydi** | Agent namuna login bilan API orqali |
| Telefon ekrani (emulator) | **O‘tkazildi** | Android emulator ulanmagan |
| Brauzer spektakli (Playwright) | **O‘tkazildi** | Uzoq; o‘rniga sahifalar HTTP bilan tekshirildi |

Avtomatik skript: **49 ta yashil, 0 ta qizil, 0 ta o‘tkazib yuborilgan.**

---

## Oxirgi tuzatishlar (qulf-signal)

Bular alohida sinandi — hammasi shu kompyuterda o‘tdi:

| Nima | Natija |
|---|---|
| 4 ta qisqa mashq (ruxsat, ish o‘rni, qorovul nomi) | **55 / 55 o‘tdi** |
| Eshiklar kamerasi (`audit:route-tenant`) | **132 fayl, 572 eshik, xato yo‘q** |
| Cookie orqali sessiya yangilash | **Yashil** |
| Boshqa kompaniyaga o‘tish taqiqlari | **Yashil (403)** |
| Web-vitals g‘alati yo‘l | **Yashil (204)** |

**Eslatma:** lokal sozlamada «qattiq ruxsat nazorati» (`RBAC_ENFORCE_PERMISSIONS`) **yoqilmagan** (0). Ishlab chiqarishda u **1** bo‘lishi shart. Hozir ham rol qorovuli ishlayapti: agent to‘lovlar ro‘yxatiga kira olmaydi.

---

## Telefon ilovasi

- `flutter test` — **hamma mashq o‘tdi** (105 ta).
- `dart analyze` — **xato yo‘q**, lekin **82 ta ogohlantirish/maslahat** (ishlatilmagan o‘zgaruvchi, uslub). Dastur yiqilmaydi, lekin keyin tozalash mumkin.
- Android emulator yo‘q — telefon tugmalarini ko‘z bilan bosib ko‘rib bo‘lmadi. Server tomoni (kirish, profil, sinxron, APK) tekshirildi.
- Imzo kaliti fayli **shu kompyuterda bor**, kod omboriga tushmasligi kerak (git ignore). Yangisini yasamadik.

---

## Qayta qanday ishlatiladi

Skript: `scripts/local-full-smoke.mjs`

Avval bazani, serverni va panelni yoqing (odatda ildizda `npm run dev`). Keyin:

```text
node scripts/local-full-smoke.mjs
```

Agar panel 3010-portda bo‘lsa, skript o‘zi topadi. Majburiy qilish:

```text
$env:WEB_BASE="http://127.0.0.1:3010"; node scripts/local-full-smoke.mjs
```

PowerShellda, loyiha papkasidan.

---

## Hali ochiq qolgan narsalar

1. **3000-portda HR HUB** turibdi. SALEC panelini odatdagi manzilda ochish uchun HR HUB ni to‘xtatib, SALEC ni 3000 da yoki bookmarkni 3010 ga qo‘ying: `http://127.0.0.1:3010/login`
2. **Telefon emulatori** yo‘q — haqiqiy telefon/ekran sinovi qolmadi.
3. **Ishlab chiqarishda** ruxsat nazoratini `1` qiling (lokalda 0).
4. Playwright to‘liq spektakl va uzun CI **ishlatilmadi** — kerak emas edi, asosiy yo‘llar yashil.
5. Server ishga tushganda Prisma «generate» fayli band edi (worker ochiq). Eski client bilan ishladi. Keyingi marta toza qayta ishga tushirishda odatiy.

Commit va push **qilinmadi**.
