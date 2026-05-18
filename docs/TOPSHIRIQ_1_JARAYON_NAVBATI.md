# Topshiriq 1 — Ish jarayonining to‘g‘ri navbati (nimadan keyin nima)

Bu hujjat **dasturchi emas** odam ham tushunishi uchun yozilgan. Maqsad: tizimda ma’lumot va ishlar **qaysi tartibda** bog‘lanishini ko‘rsatish — masalan, avval mijoz, keyin ombor qoldig‘i, so‘ng zakaz.

---

## Nima uchun bu navbat kerak?

- **Mijoz** bo‘lmasa, kimga zakaz yoziladi?
- **Mahsulot va narx** bo‘lmasa, zakaz summasi chiqmaydi.
- **Ombor** bo‘lmasa, “qancha qoldiq bor” degan savolga javob yo‘q, zakazni yopish qiyin.
- **To‘lov** va **kassa** odatda zakazdan keyin keladi.

Shuning uchun loyihani tekshirganda ham, yangi funksiya qo‘shganda ham **shu tartib** asos bo‘ladi.

---

## Qisqa “zanjir” (misol bilan)

Quyidagi ketma-ketlik **mantiqiy bog‘liqlik** bo‘yicha: oldingi qadam keyingisiga yo‘l ochadi.

| Tartib | Bo‘lim | Oddiy tushuntirish | Panelda qayerdan ochiladi (asosiy yo‘l) |
|--------|--------|---------------------|----------------------------------------|
| 1 | **Kirish va tashkilot** | Kim kiradi, qaysi kompaniya (tenant) | `/login` |
| 2 | **Ma’lumotlar bazasi (spravochnik)** | Omborlar, to‘lov turlari, kategoriyalar… | `/settings` ichidagi bo‘limlar, `/settings/spravochnik/...` |
| 3 | **Mahsulot va narx** | Nima sotiladi, qancha turadi | `/settings/prices`, matritsa, mahsulot katalogi |
| 4 | **Mijozlar** | Kimga ishlaymiz | Chap menyu **Клиенты** → `/clients`, xarita, QR, birlashtirish |
| 5 | **Xodimlar va hudud** | Agent, ekspeditor, hudud | **Пользователи** → agentlar, ekspeditorlar, `/territories` |
| 6 | **Ombor (sklad)** | Qoldiq, kirim, ko‘chirish | **Склад** → `/stock/...` (ombor, qoldiq, kirim) |
| 7 | **Bonus / chegirma qoidalari** | Zakazda avtomatik chegirma | `/settings/bonus-rules`, `discount-rules` |
| 8 | **Zakazlar (asosiy ish)** | Buyurtma, qaytarish, almashtirish | **Заявки** → `/orders`, `/orders/new` |
| 9 | **Nakladnylar** | Yig‘ish / jo‘natish ro‘yxati | **Накладные** → `/invoices/assembly`, `shipment`, `returns` |
| 10 | **To‘lov va balans** | Pul, qarz, boshlang‘ich balans | **Касса** → `/payments`, `/client-balances`, … |
| 11 | **Ta’minotchilar** | Yetkazib beruvchi bilan hisob | **Поставщики** → `/suppliers/...` |
| 12 | **Dashbord va hisobotlar** | Yig‘indi, tahlil | **Дашборды**, **Отчёт** → `/dashboard/...`, `/reports/...` |
| 13 | **Kirish huquqlari** | Kim nima ko‘radi | `/access` (admin) |

Bu jadval **loyihadagi chap menyu tartibiga** yaqin, lekin **ish jarayoni** uchun raqamlar “avval–keyin” ma’nosida.

---

## SALEC dagi sahifalar soni (hozirgi holat)

- Dashboard ostida taxminan **154 ta** `page.tsx` bor (`frontend/app/(dashboard)/...`).
- Bularning hammasi bir vaqtda “birinchi navbat” emas: ba’zilari sozlama, ba’zilari hisobot, ba’zilari kundalik ish.

To‘liq modul ↔ fayl xaritasi: [MODULES.md](./MODULES.md).

---

## Agar loyihani noldan qo‘lda tekshirsangiz

Har qadamda shunchaki so‘rang: **“Oldingi qadam bajarilganmi?”** Masalan, zakaz ochishdan oldin: mijoz bormi, mahsulot narxi bormi, ombor tanlanganmi?

Keyingi hujjat bu tekshiruvni **qadam-baqadam** yozadi: [TOPSHIRIQ_2_LOYIHANI_TEKSHIRISH.md](./TOPSHIRIQ_2_LOYIHANI_TEKSHIRISH.md).
