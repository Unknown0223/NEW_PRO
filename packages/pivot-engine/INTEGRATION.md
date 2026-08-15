# SALEC Frontend Integratsiyasi

> **Strategiya:** Avval **mustaqil** pivot (`packages/pivot-demo` + `@salec/pivot-engine`), keyin SavdoDesk «tchoty» moduliga ulash (**Phase 5**). WebDataRocks bilan A/B taqqoslash UI maqsad emas.

## Standalone demo (Phase 1)

```bash
npm run build:pivot-engine
npm run pivot-demo
```

`packages/pivot-demo` — to'liq pivot UI (maydonlar, zonalar, filtrlar, jadval) mock ma'lumot bilan. API talab qilmaydi.

SavdoDesk ichidagi kirish: `/reports/builder/pivot` — tenant API orqali ma'lumot yuklaydi.

## Paket bog'lanishi

### Variant 1: npm workspaces (root `packages/*`)

Root `package.json`:

```json
{
  "workspaces": ["packages/*"]
}
```

Pivot engine ni root dan boshqaring: `npm run build:pivot-engine`, `npm run test:pivot-engine`, `npm run pivot-demo`.

### Variant 2: file dependency (hozirgi default — frontend uchun)

`frontend/package.json`:

```json
{
  "dependencies": {
    "@salec/pivot-engine": "file:../packages/pivot-engine"
  }
}
```

`npm install --prefix frontend` dan oldin `packages/pivot-engine` da `npm run build` bajarilgan bo'lishi kerak.

---

## Next.js sozlash

`frontend/next.config.mjs` da `transpilePackages` ga qo'shilgan:

```js
transpilePackages: [
  // ...
  "@salec/pivot-engine"
]
```

---

## Feature flag

`frontend/.env.local`:

```env
NEXT_PUBLIC_PIVOT_ENGINE=true
NEXT_PUBLIC_PIVOT_DEMO_URL=http://127.0.0.1:5174
```

`true` yoki `1` — Virtual Pivot Engine yoqiladi.

**Production rollout:** flag yoqilganda `/reports/builder` avtomatik `/reports/builder/pivot` ga yo'naltiriladi (Virtual Pivot asosiy konstruktor). WebDataRocks: `/reports/builder/legacy`.

`frontend/lib/feature-flags.ts`:

```typescript
import { isPivotEngineEnabled } from "@/lib/feature-flags";

if (isPivotEngineEnabled()) {
  // Virtual Pivot Engine — default builder
}
```

---

## Bridge modul

`frontend/lib/pivot-bridge.ts` — SALEC API va pivot-engine o'rtasidagi yupqa qatlam:

```typescript
import {
  Aggregator,
  FilterEngine,
  salecFieldsToPivotFields
} from "@salec/pivot-engine";
import { api } from "@/lib/api";
import { isPivotEngineEnabled } from "@/lib/feature-flags";
```

---

## API endpoint mapping

| SALEC API | Maqsad |
|-----------|--------|
| `GET /api/:slug/reports/report-builder/metadata` | Maydonlar va metrikalar (`PivotField[]`) |
| `GET /api/:slug/reports/report-builder/filter-options` | Filtr variantlari |
| `POST /api/:slug/reports/report-builder/dataset` | Xom ma'lumot (`rawData`) |
| `GET /api/:slug/reports/report-builder/saved` | Saqlangan konfiguratsiyalar |
| `POST /api/:slug/reports/report-builder/saved` | Konfiguratsiyani saqlash |

### Ma'lumot oqimi

```
metadata API → salecFieldsToPivotFields() → PivotField[]
dataset API  → normalizeSalecDatasetRows() → rawData[]
FilterEngine.apply(rawData, filters, fields) → filteredData
PivotEngine.compute(filteredData, fields, config) → PivotData
```

### PivotConfig zonalar

| Zona | `PivotConfig` maydoni | Izoh |
|------|----------------------|------|
| Filtrlar | `reportFilters: string[]` | Hisobot darajasidagi maydonlar |
| Qatorlar / Ustunlar | `rows`, `columns` | Ierarxiya |
| Qiymatlar | `values` | Agregatsiyalar |
| Filtr qiymatlari | `filters: PivotFilter[]` | `reportFilters` va qator/ustun maydonlari uchun |

---

## Path aliases

Frontend `tsconfig.json` da mavjud `@/*` aliasi ishlatiladi. Pivot engine import:

```typescript
// To'g'ridan-to'g'ri paket
import { Aggregator, getFieldMembers } from "@salec/pivot-engine";

// SALEC bridge orqali (API + flag)
import { fetchReportBuilderMetadata, isVirtualPivotActive } from "@/lib/pivot-bridge";
```

---

## Test sahifasi

`frontend/app/(dashboard)/reports/builder/pivot/page.tsx` — Virtual Pivot konstruktor (API bilan).

`frontend/app/(dashboard)/reports/builder/dev/page.tsx` — Phase A modullarini sinash (ixtiyoriy).

---

## Migratsiya strategiyasi

1. **Standalone** — `packages/pivot-demo` da to'liq feature parity
2. **Integratsiya (Phase 5)** — `/reports/builder/pivot`, saqlangan hisobotlar, API
3. **Konfig migratsiya** — `wdr-slice-adapter.ts` (WDR `slice` → `PivotConfig`); frontend `report-builder-wdr-migrate.ts` (legacy ↔ WDR)
4. **Cutover** — production da virtual engine yoqiladi
5. **Cleanup** — `@webdatarocks/*` olib tashlanadi

### WDR slice adapter

```typescript
import { wdrSliceToPivotConfig, wdrReportToPivotConfig } from "@salec/pivot-engine";

const config = wdrSliceToPivotConfig(wdrReport.slice);
// yoki
const config = wdrReportToPivotConfig(savedWdrReport);
```

Agregatsiya mapping: `sum`→SUM, `distinctcount`→COUNT_DISTINCT, `percentofrow`→PERCENT_OF_ROW, `percent`→PERCENT_OF_TOTAL, `product`→PRODUCT, `index`→INDEX, `difference`→DIFFERENCE.

WDR `uniqueName` ba'zan `amount.sum` formatida keladi — `parseWdrFieldId()` ajratadi.

---

## WDR deprecation runbook (Phase 5.9)

### Hozirgi holat

| Marshrut | Maqsad |
|----------|--------|
| `/reports/builder` | Virtual Pivot ga redirect (`/reports/builder/pivot`) — flag talab qilinmaydi |
| `/reports/builder/pivot` | Virtual Pivot (asosiy) |
| `/reports/builder/wdr` | WebDataRocks (rollback) |
| `/reports/builder/legacy` | Virtual Pivot ga redirect (eski dnd-kit arxivlandi) |

### Rollout bosqichlari

1. **Staging:** `NEXT_PUBLIC_PIVOT_ENGINE=true` — virtual builder smoke test (filtrlar, save/load, export).
2. **Production canary:** bir nechta tenant uchun flag yoqish; WDR legacy link orqali rollback.
3. **To'liq cutover:** barcha tenantlar virtual pivot; nav-da WDR rollback link (`/reports/builder/wdr`).
4. **Cleanup (hozircha deferred):** `@webdatarocks/*` paketlari **olib tashlanmadi** — `/reports/builder/wdr` rollback marshruti hali WDR ga bog'liq. Paketni olib tashlash faqat quyidagilar bajarilgandan keyin:
   - Barcha saqlangan WDR hisobotlar virtual builderda ochiladi (`wdr-slice-adapter` + `extractSavedDatasetFilters`).
   - Legacy `/reports/builder/wdr` marshruti arxivlanadi yoki CDN orqali alohida yuklanadi.

### Rollback

Production da muammo bo'lsa: `/reports/builder/wdr` — WebDataRocks konstruktor. Yoki `NEXT_PUBLIC_PIVOT_ENGINE=false` (nav rollback linki uchun).

### Saqlangan hisobotlar migratsiyasi

Virtual pivot saqlash formati:

```json
{
  "dataSource": { "type": "salec-pivot-engine" },
  "salecPivotConfig": { "rows": [], "columns": [], "values": [] },
  "savdoDatasetFilters": { "dateFrom": "...", "dateTo": "...", "agentIds": [] }
}
```

WDR hisobotlar `slice` + `savdoDatasetFilters` orqali `savedReportConfigToPivotConfig()` bilan yuklanadi.

### Export va grafik

```typescript
import { exportPivotToPdf, pivotToChartData } from "@salec/pivot-engine";

await exportPivotToPdf(pivotData, { filename: "hisobot.pdf", title: "Pivot" });
const chartData = pivotToChartData(pivotData);
```
