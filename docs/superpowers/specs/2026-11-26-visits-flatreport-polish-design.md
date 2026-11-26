# #12 По визитам — FlatReport polish (A)

**Date:** 2026-11-26  
**Status:** approved (user «ha» 2026-11-26)  
**SalesDoc:** `/report/agent/visit`  
**SALEC:** `/reports/visits` · API `visits`  
**Доступ:** `reports.po_vizitam` (view/export) — o‘zgartirilmaydi

## Intent / why

Отчёт parity #12: stub navbatda #11 dan keyin; agent × davr flat KPI chrome + territory labels + review uchun to‘liq metrikalar.

## Goals

- FlatReport adapter qoladi (ustunlar / agregat o‘zgarmaydi).
- `tablePrefsId: "report.visits.v1"` + `filterGridCols: 9`.
- Territory placeholder: Зона / Область / Город (kod emas).
- Filtr `kind: "search"` olib tashlanadi; jadval `clientTableSearch` qoladi.
- Lokalda `visited` / `planned` ko‘rinsin (seed yoki mavjud data); smoke total > 0.
- Contract + parity jadvalida #12 Done.

## Non-goals

- Virtual Pivot / konstruktor chrome.
- Yangi `date_type` / `dateTypeAsRadio` (BE da yo‘q; SalesDoc bydate=visit DATE — mavjud `from`/`to`).
- Product/currency filtrlari (ANALYSIS v1 da yo‘q).
- `visits-2` / `visit-totals` / `universal-visits` tegilmaydi.
- Commit/deploy (so‘ralmaguncha).

## Anti-goals

- Picker labeliga kod (`Name (code)`).
- Bo‘sh chrome polish (faqat label, seed/smoke yo‘q).

## Constraints

- ≤400 LOC; lint:errors / BE tsc / audit:max-loc.
- Picker: faqat nom; kod `searchText`.

## Approaches

| | Variant | Trade-off |
|---|---------|-----------|
| **A (tanlangan)** | FlatReport chrome + territory + search dublikat + seed | Tez; bonuses/inventory oilasi |
| B | Virtual Pivot | SD flat emas — ortiqcha |
| C | Faqat FE label | Review metrikalar 0 qolishi mumkin |

**Pick:** A.

## How (builder)

1. FE `visits/page.tsx` chrome + territory + search olib tashlash + contract.
2. Seed: agent_visits / reja (CAA) — `visited`/`planned` > 0 (idempotent).
3. Smoke filter-options / report / export; parity `#12` Done.
