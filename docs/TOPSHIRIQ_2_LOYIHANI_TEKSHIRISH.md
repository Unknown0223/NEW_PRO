# Topshiriq 2 — Loyihani navbat bo‘yicha tekshirish (to‘g‘ri / noto‘g‘ri)

Bu hujjat **loyihaning holatini baholash** uchun oddiy yo‘riqnoma. Dasturlash bilishi shart emas: har bosqichda “ishlayaptimi?” va “oldin nima bo‘lishi kerak edi?” savollari yetarli.

---

## Maqsad

1. [TOPSHIRIQ_1](./TOPSHIRIQ_1_JARAYON_NAVBATI.md) dagi tartib bo‘yicha **ketma-ket** tekshirish.
2. Agar tartib **to‘g‘ri** bo‘lsa — keyingi bosqichga o‘tish.
3. Agar **noto‘g‘ri** bo‘lsa — qaysi qadam “oldinga surilgan” yoki “yetishmayapti” ekanini yozib, tuzatish rejasiga qo‘yish.

---

## Umumiy qoidalar

| Holat | Nima qilish |
|--------|-------------|
| Sahifa ochiladi, xato yo‘q | ✅ Shu bosqich “ochilish” bo‘yicha OK |
| Ma’lumot bo‘sh | ⚠️ Oldingi bosqichda ma’lumot kiritilmagan bo‘lishi mumkin (masalan, mijoz yo‘q) |
| Qizil xato yoki 404 | ❌ Texnik yoki huquq muammosi — yozib qo‘ying, keyin tuzatiladi |
| Filtrlash chalkash | 📋 Standartlash ro‘yxatiga qo‘shing — [TOPSHIRIQ_3](./TOPSHIRIQ_3_STANDARTLASH_ROYXATI.md) |

---

## Tekshiruv ro‘yxati (qisqa checklist)

Har qator uchun: **ochish** → **bitta amal** (masalan, “Saqlash” yoki “Filtr qo‘llash”) → **natija**.

1. **Kirish** — login, chiqish, qayta kirish.
2. **Sozlamalar / spravochnik** — kamida bitta ombor va bitta to‘lov turi ko‘rinadimi.
3. **Mahsulot va narx** — mahsulot ro‘yxatida narx turi bo‘yicha narx bormi.
4. **Mijozlar** — yangi mijoz yoki mavjud mijoz kartasi ochiladimi.
5. **Xodimlar** — agent ro‘yxati (zakaz uchun kerak).
6. **Ombor** — qoldiq sahifasi yuklanadimi, ombor tanlanadimi.
7. **Zakaz** — yangi zakaz yaratish (mijoz + ombor + qatorlar).
8. **Zakaz ro‘yxati** — yaratilgan zakaz ko‘rinadimi (filtrsiz ham).
9. **To‘lov** — to‘lov qo‘shish yoki balans sahifasi ochiladimi.
10. **Hisobot** — bitta oddiy hisobot (masalan, agent bo‘yicha) sanasi bilan yuklanadimi.

Agar 7–8 qadamda xato bo‘lsa, odatda 3–6 qadamni qayta tekshiring.

---

## Dasturchi uchun (ixtiyoriy, tezroq tekshiruv)

Lokal muhitda:

- Backend va frontend ishga tushgan bo‘lsa, brauzerda yuqoridagi checklist.
- Avtomatlashtirilgan “smoke” testlar frontend `package.json` da `test:e2e:smoke` orqali mavjud (login, dashboard, zakazlar kabilar).

Bu **to‘liq qamrov emas**, lekin asosiy yo‘llar sindirilmaganini tez ko‘rsatadi.

---

## Natijani qanday qayd etish

Oddiy jadval yetarli:

| Bosqich | To‘g‘ri? | Izoh |
|---------|----------|------|
| Mijozlar | Ha | |
| Ombor | Yo‘q | Filtr ochilganda matn kesilib qoladi |

Shu jurnal **keyingi tuzatishlar** uchun asos bo‘ladi.

---

## Bog‘liq hujjatlar

- Jarayon tartibi: [TOPSHIRIQ_1](./TOPSHIRIQ_1_JARAYON_NAVBATI.md)
- Interfeysni bir xil qilish: [TOPSHIRIQ_3](./TOPSHIRIQ_3_STANDARTLASH_ROYXATI.md)
- PR/CI buyruqlari va seed: [PRODUKTIVLIK_TAYYORLASH.md](./PRODUKTIVLIK_TAYYORLASH.md)
- Buyurtmalar moduli texnik oqim: [ORDERS_MODULE_API_UI_FLOW.md](./ORDERS_MODULE_API_UI_FLOW.md)
