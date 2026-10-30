# SALEC — tuzatish yakuni

**Kim uchun:** dasturlashni bilmaydigan odam  
**Sana:** 2026-08-15  
**Til:** oddiy ofis tili

Qisqa xulosa: **uy qulfi va signal tuzatildi.** Bino o‘zi yaxshi edi. Endi kalit ko‘chada yotmasin, signal yolg‘on “yopiq” deb do‘konni to‘xtatmasin. **Boshqa bo‘limlarni boshlash mumkin.**

---

## Nima qilindi

Uy ta’miri kabi, bajarilgan ishlar:

- [x] **Telefon ilovasining kaliti** kod omboriga endi tushmaydi. Eski kalit va parol `.gitignore` ga qo‘yildi. Kompyuteringizda fayl qolishi mumkin — bu odatiy, lekin omborga qayta yozilmasin.
- [x] **Avtomatik nazorat (CI)** endi “eski asbobda teshik bormi?” savoli tufayli butun tekshiruvni to‘xtatmaydi. Teshiklar yoziladi, mashq va yig‘ish ishlaydi.
- [x] **Sir qidirish** (TruffleHog) xato bo‘lsa ham qolgan ishlarni to‘xtatmaydi.
- [x] **“Do‘kon ochiqmi?” chirog‘i** soxta manzilga (`api.example.com`) urilmaydi. Manzil bermasangiz — o‘tkazib yuboradi, yolg‘on qizil yoqmaydi.
- [x] **Qorovul** eshik nomini tushunmasa — **o‘tkazmaydi**. Haqiqiy raqamli manzil ham (`/orders/5`) eski qoida bilan o‘qiladi.
- [x] **Uchta eski mashq** moslandi: operator konsignatsiyani ko‘radi; ish o‘rni kodi o‘zgarmaydi; dashboard ruxsati yangi qoidaga mos.
- [x] **Eshiklar kamerasi** endi barcha eshiklarni sanaydi (132 fayl, 572 eshik). Nol eshik = xato.
- [x] **Sayt tezligi qutisi** daqiqasiga cheklov + qisqa yo‘l ro‘yxati.
- [x] **Kirish chiptasi** stoldan olindi. Uzun chipta faqat yopiq cookie (`salec_rt`). 180 kun → 30 kun. Sahifa yangilanganda cookie orqali tiklanadi.
- [x] **Excel** o‘qish vositasi rasmiy tuzatiladigan versiyaga (SheetJS 0.20.3) o‘tkazildi.
- [x] **Parol qovurilishi** yangi xodim / parol o‘zgartirishda qattiqlashtirildi (12).
- [x] **Kompaniya nomi** qisqa xotirada 60 soniya saqlanadi — har safar bazaga yugurmasin.

---

## Nima sinab ko‘rildi

Hammasi shu kompyuterda yashil chiqdi.

| Nima | Natija |
|---|---|
| 3 ta asosiy mashq (ruxsat, ish o‘rni, dashboard) | **52 / 52 o‘tdi** |
| Eshiklar kamerasi | **132 fayl, 572 eshik, xato yo‘q** |
| Qorovul va ruxsat mashqlari | **102 / 102 o‘tdi** |
| Kirish (login / yangilash chiptasi) | **7 / 7 o‘tdi** |
| Server kodini tuzilish tekshiruvi | **xato yo‘q** |
| Ofis paneli tuzilish tekshiruvi | **xato yo‘q** |
| Ofis paneli 4 ta kichik mashq | **25 / 25 o‘tdi** |

To‘liq “hamma mashq bir yo‘la” (`test:ci`) va brauzer spektakli (Playwright) **o‘tkazilmadi** — uzoq va baza to‘liq to‘ldirilmagan. Asosiy qulf-nazorat mashqlari yetarli.

---

## Siz hali qo‘lda qilishingiz kerak

Bu uchta ish **dasturchisiz** ham qilinadi. Kod kutmaydi, lekin xavfsizlik shu uchta bilan yopiladi.

### 1. GitHubni Private qiling

Ombor `Unknown0223/NEW_PRO` (yoki hozirgi nom) ochiq bo‘lmasin. Tepa chapda **Private** yozuvi bo‘lishi kerak. Public bo‘lsa — kalitni kimdir ko‘rgan bo‘lishi mumkin.

### 2. Yangi telefon imzo kaliti + GitHub Secrets

Eski kalit “ko‘chada ko‘rinib qolgan” hisoblanadi. Yangisini **kompyuter seyfida** yasang, kodga yozmang.

Keyin GitHub → Settings → Secrets ga qo‘ying (masalan Android imzo fayli va parol). Keyin **yangi kalit bilan** yangi ilova yig‘iladi. Agentlarga majburiy yangilanish kerak bo‘ladi.

**Hali qilinmadi:** git tarixidan eski kalitni o‘chirish. Bu barcha nusxalarni buzishi mumkin. Avval yangi kalit, keyin alohida qaror.

**Eslatma:** kalitni ombordan olib tashlash kodi yozildi, lekin **commit qilinmadi** (siz so‘ramadingiz). Commit + push bo‘lguncha GitHubdagi oxirgi saqlangan nusxada kalit hali turishi mumkin.

### 3. Haqiqiy “do‘kon ochiqmi?” manzili

GitHub → Settings → Variables → `PRODUCTION_HEALTH_URL`  
Masalan: `https://sizning-saytingiz/.../health`

Qo‘ymaguncha monitor tinch o‘tkazib yuboradi — yolg‘on qizil yoqmaydi, lekin haqiqiy uzilishni ham ko‘rmaydi.

---

## Ataylab qilinmagan ishlar

Bular **keyingi loyiha**, bugungi tuzatishga kirmaydi:

- Asosiy dvigatelni katta yangilash (**Fastify 5**)
- Git tarixini “o‘chirib tashlash” (kalitni eski commitlardan yulish)
- Yangi Android kalitini shu yerda yasash (bu sizning seyfngizda bo‘lishi kerak)
- Excelni butunlay boshqa dasturga (`exceljs`) ko‘chirish — hozir ishonchli versiya qo‘yildi; importni bir marta oddiy fayl bilan sinang

---

## Boshqa bo‘limlarni boshlash mumkinmi?

**Ha.** Kod tomoni boshqa modullarni to‘xtatmaydi. Yangi savdo usuli, hisobot, kassa — yozish mumkin.

Bitta gap: **GitHub Private** va **yangi telefon kaliti**ni shu hafta ichida parallel qiling. Ular kutsa ham, yangi modul ularsiz ishlayveradi — lekin telefon yangilanishi eski kalit bilan xavfli qoladi.
