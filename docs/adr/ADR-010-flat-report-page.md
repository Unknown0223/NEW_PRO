# ADR-010: FlatReportPage — FE deep module + thin adapters

**Status:** Accepted (grill-with-docs, 2026-11-20)  
**Date:** 2026-11-20  
**Related:** GLOSSARY «FlatReportPage»; ADR-012 Report family; architecture review deepen #1 (vs Flexmonster / SalesDoc flat ports)

## Context

~22 SalesDoc **CLONE_FIT** hisobot sahifasi bir xil chrome ni qayta yozadi: draft/applied filtr, filter-options + report query, jadval, totals, pager, Excel blob. `DiscountOrdersReportPage` ikki path (`discount-detail`, `universal-discounts`) uchun tor composer isbotlagan, lekin ustunlar/filtrlar hali fayl ichida qattiq; umumiy **FlatReport config** yo‘q. Wave-1 dagi `bonuses` / `cumulative-bonus` / `outlet-class` da `group_by` (dynamic columns), outlet da `bands`, ko‘pida client `tableSearch` bor. Backendda har report uchun `*.filters` / `*.report` / `*.export` vertical triad saqlanadi. Virtual Pivot bu oilaga kirmaydi.

## Decision

1. **FlatReportPage (FE deep module)** — bitta implementation: draft/applied, filter-options + report so‘rovlari, ustunlar, totals, pager, in-module Excel blob. Public interface — deklarativ **FlatReport config**.

2. **FlatReport adapter** — thin `app/(dashboard)/reports/<slug>/page.tsx`: faqat config (+ ixtiyoriy formatter). Chrome qayta yozilmaydi.

3. **M1 qamrov = faqat FE.** Backend vertical modules (`*.filters` / `*.report` / `*.export`) M1 da o‘zgarmaydi.

4. **Export** — M1 da FlatReportPage ichida (HTTP `.../export` → blob + permission). **ReportExport (#3)** alohida deepen; #1 ni #3 ga bog‘lamaymiz.

5. **CLONE_FIT vs PARTIAL vs CUSTOM_OUT**  
   - **CLONE_FIT** — draft/applied + flat jadval + pager + export blob; `group_by` / `bands` / client `tableSearch` ham oila ichida.  
   - **PARTIAL** — chrome/oiladan chiqish (chart, pivot/workspace, URL-sync builder, non-table primary UI, configga sig‘maydigan workflow). M1 emas.  
   - **CUSTOM_OUT** — og‘ir/no-flat (masalan ~900 LOC sales).

6. **M1 FlatReport config** (kengaytirilgan; tor 3-kind rad):  
   - Identity: `title`, `apiPath`, `exportPermission`, `exportFilename`, `exportLimit?` (default 5000), `defaultLimit?` (50)  
   - `filterFields[]` kinds: `dateRange` | `search` | `multiSelect` | `select` (`date_type` / `group_by`) | `bands`  
   - Territory `*_list` = oddiy `multiSelect` + `optionsFrom` (alohida cascade kind emas)  
   - `columns`: static `ColumnDef[]` yoki `(ctx) => ColumnDef[]`  
   - `totalsKeys`, ixtiyoriy `clientTableSearch`, ixtiyoriy `formatters`

7. **MultiFilter** — bitta nusxa `frontend/components/reports/flat-report/` ichida (alohida deepen emas). Picker: `title` = nom, `searchText` = nom+kod.

8. **Wave-1 adapterlar** — `discount-detail`, `universal-discounts`, `bonuses`, `cumulative-bonus`, `visits`, `outlet-class`. Wave-2: `rfm`, `prices`, qolgan CLONE_FIT.

9. **Fayl** — deep: `frontend/components/reports/flat-report/`; adapterlar: `reports/<slug>/page.tsx`. `discount-orders-report-page.tsx` M1 oxirida o‘chadi.

10. **Migratsiya (M1)**  
    1. M1.1 — FlatReportPage extract (`DiscountOrdersReportPage` dan) + discount juftligi adapter ✅ (2026-11-20)  
    2. M1.2 — `bonuses`, `cumulative-bonus`, `visits`, `outlet-class` adapter ✅ (2026-11-20)  
    3. M1.3 — source-contract: wave-1 `page.tsx` da `emptyDraft` / inline MultiFilter yo‘q ✅ (2026-11-20)  

**M1 checklist yopildi** (2026-11-20).  

## Consequences

- Yangi CLONE_FIT avvalo FlatReport adapter; inline page clone taqiqlanadi (wave-1 contract, keyin kengayadi).
- Backend export/query siloslari M1 da qoladi — FE locality yaxshilanadi; ReportExport (#3) alohida navbat.
- Kengaytirilgan filterKinds wave-1 ni to‘liq qamrab oladi; PARTIAL/CUSTOM_OUT M1 dan tashqarida qoladi.
- Pivot / report-builder / dashboard `SalesDataTable` bu ADR qamrovida emas.

## Alternatives considered

- **FE + backend FlatReport birga** — rad: asosiy og‘riq FE clone farm; backend triad barqaror.
- **Hook-per-report + dumb shell** — rad: yana shallow clone; deklarativ config = bitta interface.
- **Exportni boshidanoq ReportExport (#3)** — rad: #1 ni #3 ga bog‘lash M1 ni kengaytiradi; blob path DiscountOrders da isbotlangan.
- **Tor M1 filterKinds (`dateRange` \| `multiSelect` \| `search` only)** — rad: wave-1 (`group_by` / `bands` / `tableSearch`) PARTIAL ga siqilib qolardi yoki adapterlar yaroqsiz bo‘lardi.
- **Birinchi wave = barcha ~22 CLONE_FIT** — rad: inventar + regressiya xavfi; wave-1 → wave-2.
- **packages/pivot-ui yoki Virtual Pivot ga yig‘ish** — rad: flat jadval ≠ cube.
- **MultiFilter ni alohida shared UI deepen** — rad: faqat flat-report ichida bitta nusxa yetarli.
