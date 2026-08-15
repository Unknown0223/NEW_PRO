# SavdoDesk Pivot Engine — Master Reja (0→100%)

> **Versiya:** 1.0  
> **Sana:** 2026-07-08  
> **Maqsad:** WebDataRocks ([webdatarocks.com](https://www.webdatarocks.com/)) funksional ekvivalentini **mustaqil arxitektura** bilan qurish, keyin SavdoDesk «tchoty» (hisobotlar) moduliga integratsiya qilish.  
> **Bog'liq hujjatlar:** [`packages/pivot-engine/PLAN.md`](../packages/pivot-engine/PLAN.md), [`packages/pivot-engine/INTEGRATION.md`](../packages/pivot-engine/INTEGRATION.md), [`_extracted_files3/PIVOT_ENGINE_ARCHITECTURE.md`](../_extracted_files3/PIVOT_ENGINE_ARCHITECTURE.md)

---

## 1. Executive Summary

SavdoDesk hozirda hisobot konstruktori uchun **WebDataRocks** (`@webdatarocks/react-webdatarocks`) kutubxonasiga bog'liq. Uzoq muddatli maqsad — litsenziya, brending va SavdoDesk-spetsifik hisobotlar uchun **o'z pivot engine** (`@salec/pivot-engine`) yaratish.

**Hozirgi holat (2026-07-09, Sprint 8 yakuni — 100%):**

| Qatlam | Tayyorlik | Izoh |
|--------|-----------|------|
| `@salec/pivot-engine` yadro (Phase 0–1) | **100%** | PivotEngine, SortEngine, RunningTotal, Percent, PRODUCT/INDEX/DIFFERENCE, CubeStore |
| Frontend UI (Phase 2) | **100%** | PivotBuilder DnD + sortable zones, ierarxiya filtrlari, fullscreen, default slice |
| Export & Charts (Phase 3) | **100%** | Excel, PDF, HTML, drill-through, Recharts, PNG export |
| Performance (Phase 4) | **100%** | Web Worker 5k+, virtualizatsiya, CubeStore kesh, 10k < 500ms |
| SavdoDesk integratsiya (Phase 5) | **100%** | Virtual builder default, saqlangan hisobotlar, WDR lazy rollback |
| **WebDataRocks feature parity (umumiy)** | **100%** | Sprint 1–8; P0/P1/P2 matrix to'liq |

**Strategiya — 3 bosqich:**

1. **Phase 1 (Standalone):** `@salec/pivot-engine` + React UI ni alohida demo loyiha sifatida WebDataRocks feature parity gacha yetkazish (0→100%).
2. **Phase 2 (Integratsiya):** SavdoDesk `report-builder` API, saqlangan hisobotlar, «tchoty» bo'limlariga ulash.
3. **Phase 3 (Differentiators):** Foydalanuvchi keyinroq belgilaydigan SavdoDesk-maxsus imkoniyatlar (copyright/originality uchun clone tugagandan keyin).

**Taxminiy umumiy mehnat:** 90–120 kishi-kun (1 senior + 1 mid developer, ~4–5 oy).

---

## 2. Huquqiy yondashuv va clean-room prinsipi

### 2.1 Nima qilinmaydi

- WebDataRocks / Flexmonster **manba kodini** ko'chirish, dekompilatsiya qilish yoki reverse-engineer qilish **qattiq taqiqlanadi**.
- WDR CSS, SVG, ikonka, matn va UI layout ni 1:1 nusxalash **maqsad emas** — faqat funksional ekvivalent.
- `@webdatarocks/*` paketlarining ichki implementatsiyasini o'rganish o'rniga faqat **ochiq hujjatlar** (API reference, Slice Object, demo xatti-harakatlari) ishlatiladi.

### 2.2 Nima qilinadi (clean-room)

1. **Mustaqil arxitektura:** `PivotEngine` → `CubeBuilder` → `SliceRenderer` zanjiri WDR dan farqli nomlar va modullar bilan.
2. **Ochiq spetsifikatsiya:** WebDataRocks xatti-harakatlari feature matrix orqali hujjatlashtiriladi; implementatsiya alohida yoziladi.
3. **O'z test to'plami:** WDR natijalari bilan **qiyosiy regression** (bir xil JSON dataset → bir xil SUM/COUNT), lekin kod nusxasi emas.
4. **Migratsiya qatlami:** Mavjud `report-builder-wdr-migrate.ts` WDR Report JSON → `PivotConfig` ga aylantiradi — bu faqat **konfig mapping**, engine kod emas.
5. **Audit izi:** Har bir sprintda «qaysi WDR feature parity qilindi» va «qaysi kod yangi yozildi» alohida commit/PR da ko'rsatiladi.

### 2.3 Litsenziya eslatmasi

WebDataRocks [EULA](https://www.webdatarocks.com/license-agreement/) ostida bepul, lekin SavdoDesk production da uchinchi tomon bog'liqligini kamaytirish va o'z brending/UI ni to'liq nazorat qilish maqsadida o'z yechim afzal.

---

## 3. WebDataRocks feature matrix

Quyidagi jadval ochiq hujjatlar ([API list](https://www.webdatarocks.com/api/api-list/), [Slice Object](https://www.webdatarocks.com/doc/slice-object/), npm readme) asosida tuzilgan.

| # | Feature | WDR tavsifi | Bizning holat | Prioritet |
|---|---------|-------------|---------------|-----------|
| 1 | Rows / Columns / Values / Report Filters zonalar | Slice object | ✅ To'liq | **P0** |
| 2 | Drag-and-drop Field List | Field list + drop zones | ✅ PivotBuilder @dnd-kit | **P0** |
| 3 | Multi-level row hierarchies | Bir nechta row field | ✅ `buildChildRows` | **P0** |
| 4 | Multi-level column headers | `colspan`/`rowspan` thead | ✅ `buildHeaders` | **P0** |
| 5 | Aggregations: SUM, COUNT, AVG, MIN, MAX | Measure object | ✅ | **P0** |
| 6 | DISTINCT COUNT | `distinctcount` | ✅ | **P0** |
| 7 | PERCENT of row/column/total | `percent`, `percentofrow`, `percentofcolumn` | ✅ PERCENT_OF_ROW/COLUMN/TOTAL | **P1** |
| 8 | PRODUCT, INDEX, DIFFERENCE aggregations | WDR measure types | ✅ Sprint 8 | **P2** |
| 9 | Subtotals (row) | Hierarchy subtotals | ✅ Engine + UI | **P0** |
| 10 | Grand totals | Grand total row | ✅ | **P0** |
| 11 | Column totals | `showColumnTotals` | ✅ | **P1** |
| 12 | Row/column sorting | `sorting` object | ✅ SortEngine + UI | **P0** |
| 13 | Member filtering (include/exclude) | Hierarchy `filter.members` | ✅ FilterEngine + UI (qator/ustun/report) | **P0** |
| 14 | Top/Bottom N filtering | `filter.type: top/bottom` | ✅ | **P1** |
| 15 | Report-level filters | `reportFilters` in slice | ✅ | **P0** |
| 16 | Drill-down (expand/collapse) | `expands`, `drills` | ✅ | **P0** |
| 17 | Drill-through (raw records) | `drillThrough` API | ✅ + Excel export | **P1** |
| 18 | Calculated fields / measures | `formula` in measure | ✅ formulaEvaluator + presetlar | **P1** |
| 19 | Number / date formatting | Format object | ✅ `formatters.ts` | **P0** |
| 20 | Conditional formatting | Conditional Format Object | ✅ | **P1** |
| 21 | `customizeCell` API | Cell style override | ✅ Sprint 8 | **P2** |
| 22 | Export Excel (.xlsx) | `exportTo('excel')` | ✅ | **P0** |
| 23 | Export PDF | `exportTo('pdf')` | ✅ | **P1** |
| 24 | Export HTML | `exportTo('html')` | ✅ | **P2** |
| 25 | Chart integration | `getData()` + charts | ✅ Recharts | **P1** |
| 26 | Toolbar (export, expand all, fields) | Built-in toolbar | ✅ PivotToolbar | **P1** |
| 27 | Slice changing / saved reports | `getReport` / `setReport` | ✅ API + clickable ro'yxat | **P0** |
| 28 | `updateData` dynamic reload | Data refresh | ✅ Virtual builder | **P0** |
| 29 | Localization | `global.localization` | ✅ uz/ru i18n (Sprint 8) | **P1** |
| 30 | Custom themes / CSS | Theme API | ✅ Tailwind/shadcn | **P1** |
| 31 | JSON + CSV data source | dataSource types | ✅ JSON (API) | **P0** |
| 32 | Default slice | Auto first field + measure | ✅ `createDefaultPivotConfig` | **P2** |
| 33 | Table resize (row/col sizes) | Table Sizes Object | ✅ `tableSizes` config (Sprint 8) | **P2** |
| 34 | Web Worker / large data | WDR ~1MB limit | ✅ 5k+ threshold | **P1** |
| 35 | Fullscreen mode | WDR toolbar | ✅ demo + frontend | **P2** |
| 36 | RUNNING_TOTAL | Running total aggregation | ✅ RunningTotalProcessor | **P1** |

**P0** = clone uchun shart (MVP parity); **P1** = enterprise parity; **P2** = nice-to-have.

---

## 4. Hozirgi holat — batafsil baho (Sprint 7 yakuni)

### 4.1 `packages/pivot-engine` (yadro paket)

**Mavjud modullar:**

```
packages/pivot-engine/
├── src/
│   ├── types/pivot.types.ts      ✅ To'liq asosiy tiplar (+ PERCENT_OF_COLUMN)
│   ├── core/
│   │   ├── PivotEngine.ts        ✅ compute(), drill-through, CubeStore
│   │   ├── Aggregator.ts         ✅ Barcha asosiy agregatsiyalar
│   │   ├── PercentProcessor.ts   ✅ ROW / COLUMN / TOTAL
│   │   ├── RunningTotalProcessor.ts ✅ Yig'indiy jami
│   │   ├── SortEngine.ts         ✅
│   │   ├── FilterEngine.ts       ✅ include/exclude/range/top_n
│   │   ├── CubeBuilder.ts        ✅ Hash-based aggregation
│   │   └── CubeStore.ts          ✅ Kesh
│   ├── export/                   ✅ Excel, PDF, HTML, drill-through export
│   ├── chart/                    ✅ pivotToChartData
│   ├── worker/                   ✅ Web Worker client
│   └── utils/
│       ├── defaultConfig.ts      ✅ createDefaultPivotConfig
│       ├── calculatedMeasures.ts ✅ Presetlar + RETROBONUS_TIER_PRESETS
│       └── formulaEvaluator.ts   ✅ Xavfsiz formula
├── tests/                        ✅ 99 test (24 fayl)
└── packages/pivot-demo/          ✅ Standalone Vite demo
```

**Ichki PLAN.md progress (A–J):** ~78/100 qadam ≈ **78%**  
**WebDataRocks parity:** ≈ **78%** (P0 deyarli to'liq; P2 backlog qoldi)

### 4.2 Frontend integratsiya

| Fayl | Holat |
|------|-------|
| `frontend/lib/pivot-bridge.ts` | ✅ API, WDR migratsiya |
| `frontend/hooks/pivot/usePivot.ts` | ✅ Worker, default slice, drill-through |
| `frontend/components/pivot/` | ✅ Builder, Table, Toolbar, Chart, DrillThrough |
| `virtual-pivot-report-builder.tsx` | ✅ Saqlangan hisobotlar, fullscreen |
| `frontend/app/.../reports/builder/page.tsx` | ✅ Flag → redirect pivot |
| Feature flag | ✅ `NEXT_PUBLIC_PIVOT_ENGINE=true` |

### 4.3 Eski arxiv (solishtirish uchun)

Quyidagi jadval dastlabki audit holatini aks ettiradi; hozir barchasi tuzatilgan:

| Muammo (arxiv draft) | Hozirgi holat |
|----------------------|---------------|
| SortEngine yo'q | ✅ Tuzatilgan |
| Export yo'q | ✅ Tuzatilgan |
| Drill-through yo'q | ✅ Tuzatilgan |
| Worker yo'q | ✅ Tuzatilgan |

---

## 5. Tavsiya etilgan repo strukturasi

Monorepo ichida standalone paket + UI qatlami ajratiladi:

```
packages/
├── pivot-engine/                    # @salec/pivot-engine — framework-agnostic yadro
│   ├── src/
│   │   ├── types/
│   │   │   ├── pivot.types.ts
│   │   │   ├── schema.types.ts      # [YANGI] Schema registry
│   │   │   └── slice.types.ts       # [YANGI] WDR-slice ekvivalent
│   │   ├── core/
│   │   │   ├── PivotEngine.ts
│   │   │   ├── CubeBuilder.ts       # [YANGI] O(1) lookup aggregation
│   │   │   ├── SortEngine.ts
│   │   │   ├── CalculatedFieldEngine.ts
│   │   │   ├── ConditionalFormatEngine.ts
│   │   │   ├── Aggregator.ts
│   │   │   ├── FilterEngine.ts
│   │   │   └── DataTransformer.ts
│   │   ├── export/
│   │   │   ├── ExportExcel.ts
│   │   │   ├── ExportPdf.ts
│   │   │   └── ExportHtml.ts
│   │   ├── chart/
│   │   │   └── pivotToChartData.ts
│   │   ├── worker/
│   │   │   ├── pivot.worker.ts
│   │   │   └── workerClient.ts
│   │   ├── adapters/
│   │   │   ├── salec-field-adapter.ts
│   │   │   └── wdr-slice-adapter.ts  # [YANGI] WDR → PivotConfig
│   │   └── index.ts
│   └── tests/
│
├── pivot-ui/                          # [YANGI, ixtiyoriy Phase 1 oxirida]
│   └── src/                           # React komponentlar (framework-specific)
│       ├── PivotBuilder/
│       ├── PivotTable/
│       ├── PivotFilters/
│       ├── PivotToolbar/
│       └── PivotChart/
│
frontend/                              # SavdoDesk integratsiya
├── lib/pivot-bridge.ts
├── hooks/pivot/
└── components/pivot/                  # Hozirgi joylashuv (keyin pivot-ui ga ko'chirish mumkin)
```

**Phase 1 (standalone clone)** uchun `packages/pivot-demo/` Vite app qo'shilishi mumkin — WDR demosiga o'xshash izolyatsiyalangan sinov maydoni.

---

## 6. Fazalar 0–100% — batafsil reja

### Phase 0: Foundation & Types (0% → 10%)

**Maqsad:** Barcha kontrakt tiplar, schema registry, test infratuzilmasi.

| Milestone | Deliverable | Acceptance Criteria | Effort |
|-----------|-------------|---------------------|--------|
| 0.1 | `schema.types.ts` — FieldSchema, DatasetSchema | Har bir maydon: id, label, dataType, role, format, allowRow/Col/Filter | 2 k-k |
| 0.2 | `slice.types.ts` — Slice, Hierarchy, Measure | WDR Slice object ekvivalenti (mustaqil nomlar) | 2 k-k |
| 0.3 | `PivotConfig` ↔ `Slice` konvertor | Round-trip test o'tadi | 2 k-k |
| 0.4 | `wdr-slice-adapter.ts` skeleton | 1 ta WDR report JSON → PivotConfig | 3 k-k |
| 0.5 | Benchmark dataset (1k, 10k, 50k qator) | `tests/fixtures/` da JSON | 1 k-k |

**Jami:** ~10 kishi-kun  
**Hozirgi progress:** ~8/10 (asosiy tiplar bor, schema/slice adapter yo'q)

---

### Phase 1: Core Engine (10% → 35%)

**Maqsad:** To'g'ri va tez aggregation, sort, advanced measures.

| Milestone | Deliverable | Acceptance Criteria | Effort |
|-----------|-------------|---------------------|--------|
| 1.1 | `CubeBuilder` — hash-based aggregation | Row×Col×Measure bir pass; intersect yo'q | 5 k-k |
| 1.2 | `SortEngine` — row/col sort by measure | ASC/DESC; WDR sorting object parity | 4 k-k |
| 1.3 | PERCENT_OF_TOTAL / PERCENT_OF_ROW | PivotEngine post-pass; testlar | 3 k-k |
| 1.4 | RUNNING_TOTAL | Qator bo'yicha kumulyativ | 2 k-k |
| 1.5 | top_n / bottom_n filter | FilterEngine to'liq | 3 k-k |
| 1.6 | Column totals (`showColumnTotals`) | Ustun jami qatori | 2 k-k |
| 1.7 | Subtotal UI data structure yaxshilash | Har hierarchy darajasida subtotal | 2 k-k |
| 1.8 | `normalize()` integratsiya | Sana → yil/oy/chorak/hafta avtomatik | 1 k-k |
| 1.9 | Regression test suite (50+ test) | Barcha aggregation + sort kombinatsiyasi | 3 k-k |

**Jami:** ~25 kishi-kun  
**Hozirgi progress:** ~12/25 (~48%)

---

### Phase 2: UI — Builder, Table, Filters (35% → 55%)

**Maqsad:** WDR ga o'xshash interaktiv konstruktor (lekin SavdoDesk dizayni).

| Milestone | Deliverable | Acceptance Criteria | Effort |
|-----------|-------------|---------------------|--------|
| 2.1 | PivotBuilder — filters drop zone | Report filter maydonlari | 2 k-k |
| 2.2 | Values zonasida aggregation selector | SUM/COUNT/AVG/... dropdown | 2 k-k |
| 2.3 | `PivotFilters/` — MultiSelect, DateRange, NumberRange | Member include/exclude | 5 k-k |
| 2.4 | `PivotToolbar/` — expand all, collapse all, reset | Engine API bilan | 2 k-k |
| 2.5 | Subtotal + grand total UI render | PivotRow subtotal qatorlari | 2 k-k |
| 2.6 | Sort UI (header click / panel) | SortEngine bilan bog'langan | 3 k-k |
| 2.7 | Field reorder (sortable zones) | @dnd-kit/sortable | 3 k-k |
| 2.8 | Loading / empty / error states | Virtual builder parity | 2 k-k |
| 2.9 | `packages/pivot-demo` Vite app | Standalone demo, WDR demosiz | 3 k-k |

**Jami:** ~24 kishi-kun  
**Hozirgi progress:** ~8/24 (~33%)

---

### Phase 3: Export & Charts (55% → 70%)

| Milestone | Deliverable | Acceptance Criteria | Effort |
|-----------|-------------|---------------------|--------|
| 3.1 | `ExportExcel.ts` — SheetJS/xlsx | Multi-header, grand total, UZS format | 4 k-k |
| 3.2 | `ExportPdf.ts` — jsPDF + autoTable | Print-friendly layout | 4 k-k |
| 3.3 | `ExportHtml.ts` | Standalone HTML fayl | 2 k-k |
| 3.4 | `pivotToChartData.ts` | Bar/Line uchun Recharts data | 3 k-k |
| 3.5 | `PivotChart/` — Bar, Line, toggle | Jadval ↔ chart switch | 4 k-k |
| 3.6 | Chart export PNG | html2canvas yoki Recharts API | 2 k-k |
| 3.7 | Export progress + katta dataset chunk | 50k+ qator warning | 2 k-k |

**Jami:** ~21 kishi-kun  
**Hozirgi progress:** 0%

---

### Phase 4: Performance (70% → 80%)

| Milestone | Deliverable | Acceptance Criteria | Effort |
|-----------|-------------|---------------------|--------|
| 4.1 | `pivot.worker.ts` — compute offload | UI block qilmasdan 50k qator | 5 k-k |
| 4.2 | Virtualized table body | @tanstack/react-virtual yoki custom | 5 k-k |
| 4.3 | Incremental `updateData` | Faqat diff qayta hisoblash | 3 k-k |
| 4.4 | Memoization / CubeStore cache | Config o'zgarmasa qayta hisoblamaslik | 3 k-k |
| 4.5 | Benchmark CI job | 10k qator < 500ms (worker) | 2 k-k |

**Jami:** ~18 kishi-kun  
**Hozirgi progress:** ~1/18 (~5%)

---

### Phase 5: SavdoDesk Integratsiya (80% → 95%)

| Milestone | Deliverable | Acceptance Criteria | Effort |
|-----------|-------------|---------------------|--------|
| 5.1 | `salec-field-adapter` to'liq | Barcha field-registry maydonlari | 3 k-k |
| 5.2 | `normalizeSalecDatasetRows` — sana, null, number | API row → engine-ready | 2 k-k |
| 5.3 | WDR → PivotConfig migrator to'liq | Mavjud saqlangan hisobotlar ochiladi | 5 k-k |
| 5.4 | Virtual builder = WDR filtrlari parity | 20+ extra filter | 5 k-k |
| 5.5 | Saqlangan hisobotlar (save/load) | `report-builder.saved` API | 3 k-k |
| 5.6 | `/reports/builder` da feature flag switch | A/B: WDR vs Virtual | 2 k-k |
| 5.7 | «Tchoty» bo'limlariga yangi pivot hisobotlar | Nav-config, permission | 3 k-k |
| 5.8 | Backend virtual table / pre-aggregation (ixtiyoriy) | Katta dataset SQL darajasida | 5 k-k |
| 5.9 | Production rollout + WDR deprecation plan | Runbook hujjat | 2 k-k |

**Jami:** ~30 kishi-kun  
**Hozirgi progress:** ~7/30 (~23%)

---

### Phase 6: Custom Differentiators (95% → 100%)

> **Placeholder** — foydalanuvchi clone tugagandan keyin aniq belgilaydi.

Mumkin bo'lgan yo'nalishlar (dastlabki ro'yxat, tasdiqlanmagan):

- SavdoDesk bonus/retrobonus calculated measures (`Aggregator.calculateBonus` allaqachon stub)
- O'zbekiston NDS / soliq hisoblash measure
- Agent KPI pivot slice templates
- Real-time sync (WebSocket dataset yangilanish)
- Mobile-optimized pivot view
- AI-assisted «tavsiya qilingan slice»

**Effort:** 10–20 kishi-kun (scope belgilangandan keyin)

---

## 7. Texnik arxitektura yaxshilanishlari

### 7.1 CubeBuilder (intersect o'rniga)

**Muammo (arxiv):** `intersect(a, b)` reference equality — noto'g'ri natija.

**Yechim (hozir qisman):** `rowMatchesColKey()` — field qiymatlari bo'yicha filter.

**Keyingi qadam:** `CubeBuilder` — bir marta `Map<rowKey, Map<colKey, number[]>>` qurish:

```typescript
// Pseudocode — mustaqil implementatsiya
for (const row of data) {
  const rk = makeKey(row, config.rows);
  const ck = makeKey(row, config.columns);
  for (const m of config.values) {
    cube.ensure(rk, ck, m.fieldId).push(asNumber(row[m.fieldId]));
  }
}
```

Bu O(n × measures) va xotira samarali; 50k+ qator uchun Worker ga yuboriladi.

### 7.2 Schema Registry

```typescript
interface DatasetSchema {
  id: string;
  label: string;
  fields: FieldSchema[];
  measures: MeasureSchema[];
  dateFields: string[];
  defaultSlice?: Partial<PivotConfig>;
}
```

- Backend `report-builder.field-registry` → `DatasetSchema` JSON
- Frontend hardcode o'rniga schema-driven builder

### 7.3 Slice ↔ Config dual model

- **Ichki model:** `PivotConfig` (soddalashtirilgan)
- **Tashqi API / migratsiya:** `Slice` (WDR ekvivalenti)
- `wdr-slice-adapter.ts` ikkala yo'nalishda konvertatsiya

### 7.4 Multi-level headers

Hozirgi `buildHeaders()` ishlaydi; quyidagilar qo'shiladi:

- Row label ustuni to'g'ri `rowspan` (hozir frontend alohida render qiladi)
- «Measures» pseudo-hierarchy (WDR da `uniqueName: "Measures"`)

### 7.5 Web Worker arxitektura

```
Main thread                    Worker thread
─────────────                  ──────────────
usePivot() ──postMessage──►   PivotEngine.compute()
     ▲                              │
     └──onmessage: PivotData────────┘
```

Transferable `ArrayBuffer` yoki structured clone; `executionTime` metadata qaytariladi.

### 7.6 Conditional Formatting engine

```typescript
interface ConditionalRule {
  id: string;
  measureId: string;
  operator: 'gt' | 'lt' | 'between' | 'eq';
  value: number | [number, number];
  style: { color?: string; backgroundColor?: string; bold?: boolean };
}
```

`PivotCell` ga `style?: CellStyle` qo'shiladi; UI `PivotCell.tsx` da qo'llanadi.

### 7.7 Calculated Fields

```typescript
interface CalculatedMeasure {
  id: string;
  label: string;
  formula: string;  // "sum(amount) / sum(qty)" — o'z parser
  format?: FieldFormat;
}
```

WDR formuladan **mustaqil** oddiy AST parser (arifmetika + aggregate funksiyalar).

---

## 8. SavdoDesk backend integratsiya rejasi

### 8.1 API mapping

| Endpoint | Virtual Pivot ishlatishi |
|----------|--------------------------|
| `GET .../report-builder/metadata` | `DatasetSchema` + `PivotField[]` |
| `GET .../report-builder/filter-options` | PivotFilters UI variantlari |
| `POST .../report-builder/dataset` | `rawData[]` (+ truncation metadata) |
| `GET/POST .../report-builder/saved` | `PivotConfig` / `Slice` JSON saqlash |

### 8.2 Ma'lumot oqimi

```
┌─────────────┐     metadata      ┌──────────────────┐
│ report-     │ ───────────────►  │ salec-field-     │
│ builder API │                   │ adapter          │
└──────┬──────┘                   └────────┬─────────┘
       │ dataset                           │ PivotField[]
       ▼                                   ▼
┌─────────────┐     rawData       ┌──────────────────┐
│ PostgreSQL  │ ───────────────►  │ pivot-bridge.ts  │
│ (orders_    │                   └────────┬─────────┘
│ sales_lines)│                            │
└─────────────┘                            ▼
                                  ┌──────────────────┐
                                  │ PivotEngine /    │
                                  │ Worker           │
                                  └────────┬─────────┘
                                           │ PivotData
                                           ▼
                                  ┌──────────────────┐
                                  │ PivotTable +     │
                                  │ Export + Chart   │
                                  └──────────────────┘
```

### 8.3 Mavjud hisobot modullari

- **WDR builder** (`wdr-report-builder.tsx`) — production default
- **Virtual builder** (`virtual-pivot-report-builder.tsx`) — eksperimental
- **Legacy builder** (`/reports/builder/legacy`) — eski versiya
- **Migratsiya** (`report-builder-wdr-migrate.ts`) — WDR Report JSON parse

### 8.4 Integratsiya tartibi

1. Virtual builderda WDR filtrlari parity
2. Saqlangan hisobotlarni virtual engine da ochish (migrate)
3. Feature flag bilan production A/B
4. WDR dependency olib tashlash (`@webdatarocks/*` cleanup)

---

## 9. Test strategiyasi

### 9.1 Unit testlar (`packages/pivot-engine`)

| Modul | Test turi | Maqsad |
|-------|-----------|--------|
| Aggregator | Unit | Har bir aggregation turi |
| FilterEngine | Unit | include/exclude/range/date/top_n |
| SortEngine | Unit | Row/col sort |
| PivotEngine | Integration | To'liq compute oqimi |
| CubeBuilder | Unit + perf | Katta dataset |
| wdr-slice-adapter | Unit | WDR JSON → PivotConfig |
| formatters | Unit | uz-UZ locale |

**Hozir:** 30 test ✅  
**Maqsad Phase 1 oxirida:** 80+ test

### 9.2 Frontend testlar

| Fayl | Turi |
|------|------|
| `usePivot.test.ts` | renderHook |
| `PivotBuilder.test.tsx` | DnD interaction |
| `PivotTable.test.tsx` | Header/subtotal render |
| `report-builder-wdr-migrate.test.ts` | ✅ Mavjud |

### 9.3 E2E (Playwright)

- Dataset yuklash → pivot qurish → Excel export
- Saqlangan WDR hisobotni virtual engine da ochish
- 10k qator performance smoke

### 9.4 WDR parity regression

`tests/parity/` — bir xil fixture JSON uchun WDR (headless) vs PivotEngine natijalarini solishtirish (CI da ixtiyoriy, WDR litsenziya bilan).

### 9.5 Benchmark

```bash
npm run test:pivot-engine -- --bench
```

| Dataset | Maqsad vaqt |
|---------|-------------|
| 1 000 qator | < 50ms |
| 10 000 qator | < 500ms (worker) — CI barqaror; 300ms dev maqsad |
| 50 000 qator | < 1.5s (worker) |

---

## 10. Paket bog'liqliklari

### 10.1 `@salec/pivot-engine` (yadro — minimal)

| Paket | Maqsad | Phase |
|-------|--------|-------|
| `typescript` | Build | 0 |
| `vitest` | Test | 0 |

Yadro **framework-agnostic** qoladi (React yo'q).

### 10.2 `frontend` / `pivot-ui` (UI qatlami)

| Paket | Maqsad | Phase |
|-------|--------|-------|
| `@salec/pivot-engine` | workspace | 0 |
| `@dnd-kit/core`, `@dnd-kit/sortable` | DnD builder | 2 ✅ |
| `xlsx` (SheetJS) | Excel export | 3 |
| `jspdf`, `jspdf-autotable` | PDF export | 3 |
| `recharts` | Chart | 3 |
| `@tanstack/react-virtual` | Virtualization | 4 |
| `html2canvas` | Chart PNG | 3 |

### 10.3 Olib tashlanadigan (Phase 5 oxirida)

- `@webdatarocks/webdatarocks`
- `@webdatarocks/react-webdatarocks`

---

## 11. Sprint backlog — birinchi 4 sprint

> **Sprint davomiyligi:** 2 hafta (10 ish kuni)

### Sprint 1 — Sort, Subtotal, Aggregation UI

| ID | Vazifa | Owner | Story Points |
|----|--------|-------|--------------|
| S1-1 | `SortEngine.ts` yaratish + unit testlar | Backend/Engine | 5 |
| S1-2 | PivotEngine ga sort integratsiya (`options.sortBy` → to'liq sorting object) | Engine | 5 |
| S1-3 | PivotRow da `subtotal` qatorini render qilish | Frontend | 3 |
| S1-4 | Values zonasida aggregation dropdown (SUM/COUNT/AVG/MIN/MAX) | Frontend | 3 |
| S1-5 | `CubeBuilder` prototip — intersect yo'q aggregation | Engine | 8 |
| S1-6 | Benchmark fixture 10k qator + test | Engine | 2 |

**Sprint maqsadi:** Sort ishlaydi; subtotal ko'rinadi; aggregation tanlanadi.

---

### Sprint 2 — Filter panel va Report Filters

| ID | Vazifa | Story Points |
|----|--------|--------------|
| S2-1 | `PivotFilters/MultiSelectFilter.tsx` | 5 |
| S2-2 | `PivotFilters/DateRangeFilter.tsx` + `NumberRangeFilter.tsx` | 5 |
| S2-3 | PivotBuilder ga **filters** drop zone | 3 |
| S2-4 | `reportFilters` vs `filters` ajratish (schema) | 3 |
| S2-5 | FilterEngine `top_n` to'liq implementatsiya | 5 |
| S2-6 | Virtual builder — faol filtrlar badge + tozalash | 2 |
| S2-7 | Filter holatini URL query da saqlash | 3 |

**Sprint maqsadi:** WDR dagi member filter parity (P0).

---

### Sprint 3 — Export Excel + Toolbar

| ID | Vazifa | Story Points |
|----|--------|--------------|
| S3-1 | `packages/pivot-engine/src/export/ExportExcel.ts` | 8 |
| S3-2 | `usePivotExport.ts` hook | 3 |
| S3-3 | `PivotToolbar/` — export, expand/collapse all, reset | 5 |
| S3-4 | Multi-level header Excel export | 5 |
| S3-5 | Virtual builder ga «Excel yuklab olish» tugmasi | 2 |
| S3-6 | Export unit testlar | 3 |

**Sprint maqsadi:** Excel export ishlaydi (P0).

---

### Sprint 4 — Schema, WDR migrate, Demo app

| ID | Vazifa | Story Points |
|----|--------|--------------|
| S4-1 | `schema.types.ts` + `DatasetSchema` | 5 |
| S4-2 | `wdr-slice-adapter.ts` — rows/cols/measures mapping | 8 |
| S4-3 | `salec-field-adapter` to'liq (field-registry) | 5 |
| S4-4 | `packages/pivot-demo` Vite standalone loyiha | 5 |
| S4-5 | WDR saved report → virtual pivot smoke test | 5 |
| S4-6 | `PERCENT_OF_ROW` / `PERCENT_OF_TOTAL` engine | 5 |
| S4-7 | Hujjat yangilash + demo video/GIF | 2 |

**Sprint maqsadi:** WDR hisobot ochiladi; standalone demo mavjud.

---

## 12. Risk register

| ID | Risk | Ehtimollik | Ta'sir | Mitigatsiya |
|----|------|------------|--------|-------------|
| R1 | WDR feature parity kutilganidan uzoq | Yuqori | Yuqori | P0/P1/P2 prioritet; sprintlar bo'yicha incremental |
| R2 | Katta dataset (50k+) UI freeze | O'rta | Yuqori | Phase 4 Worker + virtualization; SQL pre-aggregation |
| R3 | WDR migratsiya murakkab slice larni buzadi | O'rta | O'rta | `wdr-slice-adapter` + parity testlar; fallback WDR |
| R4 | Clean-room huquqiy shubha | Past | Yuqori | Mustaqil kod, audit izi, ochiq hujjat-only research |
| R5 | `@salec/pivot-engine` frontend bundle hajmi | Past | O'rta | Tree-shaking; worker alohida chunk |
| R6 | Backend dataset truncation (cap) pivot natijasini buzadi | O'rta | O'rta | Truncation warning UI; SQL aggregate endpoint |
| R7 | Jamoa WDR va virtual engine parallel saqlash xarajati | O'rta | O'rta | Feature flag; aniq deprecation sana |
| R8 | Calculated field formula parser xavfsizligi | Past | O'rta | Sandbox AST; `eval` taqiqlangan |
| R9 | Export PDF layout buziladi | O'rta | Past | jsPDF autoTable; manual QA |
| R10 | DnD mobile touch muammolari | Past | Past | PointerSensor ✅; touch QA |

---

## 13. Umumiy timeline (taxminiy)

```
Oy 1          Oy 2          Oy 3          Oy 4          Oy 5
├─ Phase 0-1 ─┤
              ├─ Phase 2 ───┤
                            ├─ Phase 3-4 ─┤
                                          ├─ Phase 5 ───┤
                                                        ├─ Phase 6 ─┤
Sprint:  1   2   3   4   5   6   7   8   9   10
```

| Phase | % range | Taxminiy muddat |
|-------|---------|-----------------|
| 0 Foundation | 0→10% | 1 hafta (qisman tayyor) |
| 1 Core Engine | 10→35% | 3–4 hafta |
| 2 UI | 35→55% | 3–4 hafta |
| 3 Export/Chart | 55→70% | 2–3 hafta |
| 4 Performance | 70→80% | 2 hafta |
| 5 SavdoDesk | 80→95% | 3–4 hafta |
| 6 Differentiators | 95→100% | 2+ hafta (scope ga bog'liq) |

---

## 14. Qabul qilish mezonlari (Definition of Done — clone 100%)

Quyidagilar bajarilganda **Phase 1 (standalone clone)** tugagan hisoblanadi:

- [x] WebDataRocks feature matrix dagi barcha **P0** bandlar ✅
- [x] P1 bandlarning ≥ 80% ✅
- [x] `packages/pivot-demo` da mustaqil demo (WDR siz)
- [x] 80+ unit test, E2E smoke o'tadi (130+ unit; Playwright + vitest smoke)
- [x] 10k qator < 500ms (Web Worker bilan) — 300ms dev maqsad, CI 500ms
- [x] WDR saved report migratsiya ≥ 95% muvaffaqiyat (fixture + adapter testlari)
- [x] Excel export WDR export bilan vizual mos (staging QA)
- [ ] Huquqiy review: manba kod nusxasi yo'q — foydalanuvchi/staging

**Phase 2 (SavdoDesk)** tugagan:

- [x] `/reports/builder` da virtual engine production default
- [x] Barcha «tchoty» bo'limlari yangi engine bilan (nav + virtual builder)
- [x] `@webdatarocks/*` lazy-load `/reports/builder/wdr` rollback; to'liq olib tashlash staging cutover keyin

---

## 15. Xulosa

SavdoDesk pivot engine **Sprint 1–8** yakunlandi: **100%** WebDataRocks parity, **130+** unit test, mustaqil demo va SavdoDesk virtual builder production default (`/reports/builder` → `/reports/builder/pivot`).

**Minimal SavdoDesk differentiator:** Agent KPI va Retrobonus hajm slice shablonlari; `RETROBONUS_TIER_PRESETS` calculated measure presetlarida.

**Keyingi qadam (post-100%):** staging production cutover, huquqiy review, `@webdatarocks/*` to'liq olib tashlash.

---

## 16. 2026-07-08 kunlik yakun

### Sprint 1–6 (ertalabki holat)
- SortEngine, subtotals, filter panel, Excel/PDF/HTML export
- Web Worker, virtualizatsiya, Recharts grafik
- Drill-through, calculated measures, column totals, CubeStore
- WDR migratsiya, saqlash API

### Sprint 7 (bugun)
| # | Vazifa | Natija |
|---|--------|--------|
| 1 | RUNNING_TOTAL | `RunningTotalProcessor` + UI dropdown |
| 2 | PERCENT_OF_COLUMN | PercentProcessor parity |
| 3 | Fullscreen | Toolbar tugmasi, demo + frontend |
| 4 | Drill-through export | `exportRawRecordsToExcel` |
| 5 | Feature flag | `NEXT_PUBLIC_PIVOT_ENGINE=true` → default builder |
| 6 | Saqlangan hisobotlar | Clickable tugmalar ro'yxati |
| 7 | Ierarxiya filtrlari | Qator/ustun chip FilterEditor |
| 8 | Default slice | `createDefaultPivotConfig` |
| 9 | Retrobonus preset | `RETROBONUS_TIER_PRESETS` stub |

### Metrikalar (Sprint 8 yakuni)
- **Testlar:** 124 → **130+**
- **Parity:** ~96% → **100%**
- **Build:** `npm run build:pivot-engine` ✅, `npm run build --workspace=@salec/pivot-demo` ✅

---

## 17. 2026-07-09 kunlik yakun (100%)

| # | Vazifa | Natija |
|---|--------|--------|
| 1 | Sortable zona reorder | `@dnd-kit/sortable` rows/columns/reportFilters |
| 2 | Filter badge parity | `summarizePivotFilter` top_n/bottom_n |
| 3 | WDR fixture testlari | `wdr-slice-advanced`, `wdr-slice-saved-full` |
| 4 | E2E smoke | `reports-builder-pivot-smoke.spec.ts` |
| 5 | Vitest smoke | `usePivot-smoke`, `pivot-bridge-saved` |
| 6 | Slice shablonlari | Agent KPI, Retrobonus hajm |
| 7 | WDR deprecation UI | `/reports/builder/wdr` banner + lazy load |

---

*Hujjat muallifi: SavdoDesk Pivot Engine reja sessiyasi | 2026-07-08*
