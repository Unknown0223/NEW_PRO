# Topshiriq 3 — Standartlash: imkoniyatlar va qilinadigan ishlar ro‘yxati

Bu hujjat **ikki qismdan** iborat:

- **A qism** — tizimda allaqachon bor yoki qo‘shish mumkin bo‘lgan “texnik tasnif” (nimani bir xil qilish mumkinligi).
- **B qism** — amalda **nimalarni** standartlash kerak (foydalanuvchi ko‘radigan farqlar).

Til oddiy: dasturchi bo‘lmagan odam ham “nima g‘alati” ekanini tushunishi uchun.

---

## A. Standartlash imkoniyatlari (texnik tasnif)

Bu yerda “nima turdagi narsalar bor” degan **sinflar** yozilgan — kod bazasiga mos.

| № | Texnik nom | Oddiy ma’nosi | Loyihada misol / joy |
|---|------------|---------------|----------------------|
| A1 | **Bir xil select ko‘rinishi** | Pastga ochiladigan ro‘yxatlar bir xil balandlik va chegaraga ega | `frontend/components/ui/filter-select.tsx` — `FilterSelect`, `filterSelectClassName` (odatda balandlik `h-9`) |
| A2 | **Keng panel select** | Filtr qatori kattaroq bo‘lishi kerak bo‘lgan joylar | Shu faylda `filterPanelSelectClassName` (`h-10`) |
| A3 | **Maxsus ko‘p tanlov (MultiFilter)** | Bir nechta qiymat tanlash, o‘z ichki komponenti | Masalan `reports/visit-totals`, `reports/visits-2` sahifalaridagi `MultiFilter` |
| A4 | **Kaskad filtrlash** | Avval viloyat, keyin shahar — ketma-ket torayadi | Mijozlar: `buildZoneRegionCityCascadeOptions`, `clients-table-toolbar` |
| A5 | **Kaskadsiz mustaqil filtr** | Har bir filter o‘zi alohida, biri boshqasiga bog‘lanmaydi | Ayrim ombor / hisobot sahifalaridagi alohida `FilterSelect` lar |
| A6 | **Yig‘iladigan (accordion) filtr paneli** | Filtrlar yopilgan, tugma bilan ochiladi | Masalan ombor qoldiq: `stock/page.tsx` da `ListFilter` ikonkasi bilan |
| A7 | **Doim ochiq filtr qatori** | Filtrlar doim ko‘rinadi | Mijozlar ro‘yxati, ko‘p hisobotlar |
| A8 | **“Qo‘llash” tugmasi** | Avval tanlaydi, keyin “Qo‘llash” bosiladi | Ba’zi hisobotlar (`draft` / `applied` holat) |
| A9 | **Darhol qo‘llanadigan filtr** | O‘zgartirilishi bilan so‘rov ketadi | Ko‘p jadval ro‘yxatlari |
| A10 | **Jadval ustun sozlamalari** | Qaysi ustunlar ko‘rinishi | `TableColumnSettingsDialog`, turli `TABLE_ID` lar |
| A11 | **Til va yorliqlar** | Menyu va sarlavhalar qaysi tilda | Chap menyu ko‘pincha ruscha, ba’zi sahifalar o‘zbekcha inglizcha aralash |

---

## B. Nimalarni standartlash kerak (amaliy ro‘yxat)

Bu ro‘yxat **foydalanuvchi aytgan muammolar** va kodda ko‘rinadigan farqlarga asoslangan. Bajarilganda “bir sahifada bir xil, boshqasida boshqacha” kamayadi.

| № | Muammo (oddiy tilda) | Nima qilish (maqsad) | Qayerda ko‘p uchraydi |
|---|----------------------|----------------------|------------------------|
| B1 | Bir joyda filtr nomi **ichida** yozilgan, boshqa joyda **ustunda** | Barcha filtrlarda bir xil qoida: masalan, bo‘sh tanlovda **filter nomi** ko‘rinadi (`emptyLabel`) | Turli `select` va `FilterSelect` |
| B2 | **Balandlik va kenglik** har xil | Bitta standart: jadval filtrlari `filterSelectClassName`; maxsus holatda `cn(..., "h-8")` kabi qo‘shimcha — hujjatlashtirilgan holda | Hisobotlar: `h-8`, `h-9` aralash; `visit-totals` `h-8 w-[4.5rem]` |
| B3 | **Kaskad** bor joyda aniq, **yo‘q** joyda foydalanuvchi kutadi | Hudud filtrlari: yoki hamma “mijozlar” kabi kaskad, yoki “kaskad yo‘q” degan qisqa izoh UI da | Mijozlar vs ba’zi boshqa ro‘yxatlar |
| B4 | Filtr **yig‘iladi**, boshqa sahifada doim ochiq — odat shakllanmaydi | Har modul uchun: “filtrlar yig‘iladigan” yoki “doim ochiq” — 2 ta shablon tanlanadi | `stock` vs `clients` |
| B5 | Panel ochilganda **chiroyli tartib**, boshqa joyda “tugmalar chalkash” | Filtr qatorida tartib: sana → hudud → status → qidiruv; bir xil oralig‘ | Turli `reports/*` |
| B6 | **Qo‘llash** bor-yo‘qligi noaniq | Yoki hamma hisobotlarda “Qo‘llash”, yoki hammasida avtomatik — ikkalasini aralashtirmaslik | `visits-2`, `visit-totals` (draft/applied) |
| B7 | **Ikonka va matn** turli uslubda | “Filtr” ikonkasi yoki “Filtrlash” matni — bitta uslub | `ListFilter`, boshqalar |
| B8 | **Til aralash** (RU/UZ/EN) | Foydalanuvchi uchun bitta asosiy til yoki i18n rejasi | `nav-config`, sahifa sarlavhalari |

---

## Qanday boshlash (soddalashtirilgan rejim)

1. **B** jadvalidan 2–3 ta eng ko‘zga tashlanadigan muammoni tanlang (masalan B1, B2, B4).
2. Bir modul ichida (masalan faqat **Hisobotlar** yoki faqat **Ombor**) bir xil qilib chiqing.
3. [TOPSHIRIQ_2](./TOPSHIRIQ_2_LOYIHANI_TEKSHIRISH.md) checklistidan o‘tib, regressiya yo‘qligini tekshiring.

---

## Kodda mavjud “yordamchi”

- Asosiy komponent: [`frontend/components/ui/filter-select.tsx`](../frontend/components/ui/filter-select.tsx)
- Chap menyu (qaysi bo‘lim qayerda): [`frontend/components/dashboard/nav-config.ts`](../frontend/components/dashboard/nav-config.ts)

---

## Bog‘liq hujjatlar

- Jarayon tartibi: [TOPSHIRIQ_1](./TOPSHIRIQ_1_JARAYON_NAVBATI.md)
- Tekshiruv: [TOPSHIRIQ_2](./TOPSHIRIQ_2_LOYIHANI_TEKSHIRISH.md)
