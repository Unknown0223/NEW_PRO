# @salec/pivot-demo

SavdoDesk Pivot Engine uchun **mustaqil** Vite + React demo. SavdoDesk API yoki WebDataRocks talab qilmaydi.

## Ishga tushirish

Root katalogdan:

```bash
npm run build:pivot-engine
npm run pivot-demo
```

Brauzer: [http://127.0.0.1:5174](http://127.0.0.1:5174)

## Imkoniyatlar (Sprint 1–7)

### Konstruktor
- Maydonlar ro'yxati (sidebar) — drag & drop
- Drop zonalar: **Filtrlar**, **Ustunlar**, **Qatorlar**, **Qiymatlar**
- Qator/ustun ierarxiya maydonlarida **filtr** ikonkasi → FilterEditor
- Qiymatlar zonasida agregatsiya: SUM, COUNT, AVG, MIN, MAX, COUNT_DISTINCT, % qator/ustun/jami, **RUNNING_TOTAL**
- Hisoblangan metrikalar presetlari: Bonus, QQS, retrobonus tier stub

### Jadval va tahlil
- Ko'p darajali qator/ustun sarlavhalari, drill-down (yoyish/yig'ish)
- **Drill-through** — katakdagi manba qatorlar (double-click), modalda **Excel export**
- Sort — sarlavhaga bosish (ASC/DESC)
- Shartli formatlash (manfiy, threshold)
- Ustun jami qatori

### Toolbar
- **Jadval / Grafik** toggle (Recharts)
- **Excel, PDF, HTML** export
- **To'liq ekran** (fullscreen) — pivot konteyner
- Hammasini yoyish / yig'ish / tiklash
- Filtrlarni tozalash

### Performance
- Web Worker — `?rows=10000` (10k+ qator)
- `@tanstack/react-virtual` — jadval virtualizatsiya
- URL query — `?pivot=` konfiguratsiya saqlash

## Klaviatura

| Amal | Tugma |
|------|-------|
| Drill-through | Katak ustida **double-click** |
| Fullscreen chiqish | **Esc** |

## Ma'lumot

`src/data/salesData.ts` — 480 qator mock savdo ma'lumoti (`SALES_FIELDS`).

## Bog'liq

- [`@salec/pivot-engine`](../pivot-engine/README.md) — yadro
- [`INTEGRATION.md`](../pivot-engine/INTEGRATION.md) — SavdoDesk integratsiyasi
