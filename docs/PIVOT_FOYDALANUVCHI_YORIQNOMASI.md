# Pivot — foydalanuvchi yo‘riqnomasi (SavdoDesk)

Qisqa qo‘llanma: pivot hisobotni qanday yig‘ish, formula, rang va export.

---

## 1. Ma’lumot yuklash

1. **Hisobotlar → Pivot** (yoki Report Builder) oching.
2. Kerakli **dataset / filtr** ni tanlang (sana, filial, agent…).
3. Ma’lumot kelgach, pastki qismda **Dataset** jadvali ko‘rinadi (sahifa ~1000 qator, scroll bilan yana yuklanadi).
4. Pivot paneli bo‘sh bo‘lsa — keyingi qadamda maydonlarni qo‘ying.

---

## 2. Maydonlar (rows / cols / values)

1. **Поля** tugmasini bosing.
2. Chapdagi ro‘yxatdan maydonni belgilang yoki **tortib** zona ga tashlang:
   - **Ряды** — qatorlar (masalan: dealer, brand)
   - **Столбцы** — ustunlar
   - **Значения** — raqamlar (Σ SUM / AVG…)
   - **Фильтры отчета** — hisobot filtri
3. Qiymatda agregatsiyani chip ichidagi ro‘yxatdan o‘zgartiring.
4. **Применить** — jadval yangilanadi; **Отмена** — qoralama bekor.

**Classic / compact / flat:** Options (Параметры) da sxema:
- **compact** — zich, ierarxiya
- **classic** — kengroq, ota katak takrorlanmasligi
- **flat** — tekis ustunlar (rawga yaqin)

---

## 3. Formulalar qo‘yish

1. **Поля** → **Добавить вычисленные…**
2. **Пресет** — tayyor variant (НДС 12%, Бонус 5%, Средний чек…).
3. Yoki **Своя формула**:
   - Nom (masalan: `Маржа`)
   - Formula: faqat **+ − * /** va qavs, masalan `amount * 0.12` yoki `amount / qty`
4. Xato bo‘lsa — ruscha xabar chiqadi (bo‘sh formula, noma’lum maydon…).
5. Qiymatlar zonasi chipida formula matni ko‘rinadi; **ƒ** — tahrirlash; **×** — o‘chirish.

> **Eslatma:** hozircha **IF / ABS / ROUND** yo‘q — faqat arifmetika.

---

## 4. Shartli format / ranglar

1. Menyudan **Условное форматирование**.
2. **+** — yangi shart: `<` `>` `=` `≥` `≤` **Между** (min…max) yoki manfiy.
3. Ixtiyoriy: **Поле** — faqat bitta metrikaga.
4. Matn/fon rangini tanlang.
5. **Heatmap presets** — tayyor issiqlik diapazonlari.
6. **Применить**.

---

## 5. Format yacheek

1. **Формат ячеек**.
2. Barcha qiymatlar yoki bitta maydon.
3. Tip: **Число / Валюта / Процент**.
4. Minglik ajratuvchi, o‘nlik, kasr xonalari, manfiy (`-1` yoki `(1)`), bo‘sh qiymat matni, shablon.
5. **Применить** — format pivot config ga yoziladi va jadvalda ko‘rinadi.

---

## 6. Export

Toolbar: **Excel / CSV / PDF / HTML / Chart PNG** (mavjud tugmalar).
Katta jadvalda biroz kutish normal — progress yozuvi chiqishi mumkin.

---

## 7. Drill-through (Options)

1. **Параметры (Options)**.
2. **Исходные записи** ni yoqing.
3. Qiymat katakchasiga **ikki marta** bosing — shu katakni bergan xom yozuvlar ochiladi.
4. Default o‘chirilgan (tasodifiy ochilmasin).

---

## 8. Classic / compact / flat — qachon nima?

| Sxema    | Qachon                                           |
|----------|--------------------------------------------------|
| compact  | Oddiy hisobot, tez ko‘rish                       |
| classic  | Ierarxiya aniq, ota qatorlar takrorlanmasin      |
| flat     | Barcha ustunlar yonma-yon, Excelga yaqin eksport |

---

Savollar bo‘lsa: ichki support / texnik jamoa. Texnik roadmap: `docs/PIVOT_PRODUCT_ROADMAP.md`.
