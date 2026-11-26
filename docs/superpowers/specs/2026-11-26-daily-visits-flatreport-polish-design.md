# #13b По дневному посещению — FlatReport polish (A)

**Date:** 2026-11-26  
**Status:** approved (user «ha» 2026-11-26)  
**SalesDoc:** `/report/reportVisit`  
**SALEC:** `/reports/daily-visits` · API `daily-visits`  
**Доступ:** `reports.po_dnevnomu_poseshcheniyu` (view/export) — o‘zgartirilmaydi

## Intent / why

Отчёт parity #13: `daily-visits` wave-2 adapter bor; filtr nomlari (Год/Месяц + oy RU) qisman qilingan. Chrome parity (#12 uslubi) va parity jadvalida Done yo‘q.

## Goals

- FlatReport adapter qoladi (flat list; SD matritsa emas).
- `tablePrefsId: "report.daily-visits.v1"` + `filterGridCols: 9`.
- Год / Месяц placeholders + oy labellari Январь…Декабрь saqlanadi.
- Filtr `kind: "search"` yo‘q; `clientTableSearch` qoladi.
- Smoke: filter-options / report / export 200; tokensiz 401; report total ≥ 0 (lokalda qatorlar bo‘lsa > 0).
- Contract + parity jadvalida #13 Done; next = prices / qolgan stublar.

## Non-goals

- SalesDoc agent×kun matritsa rewrite (`type`/`item`).
- Virtual Pivot / `dateTypeAsRadio` / `dateRange` (year/month select saqlanadi).
- `visits` / `visits-2` / `visit-totals` / `staff-attendance` tegilmaydi.
- Commit/deploy (so‘ralmaguncha).

## Anti-goals

- Picker labeliga kod.
- Faqat docs belgilash, chrome yo‘q.

## Constraints

- ≤400 LOC; lint:errors / BE tsc (daily-visits scope) / audit:max-loc.
- Picker: faqat nom; kod `searchText`.

## Approaches

| | Variant | Trade-off |
|---|---------|-----------|
| **A (tanlangan)** | FlatReport chrome + contract + parity (+ seed faqat total=0 bo‘lsa) | #12 oilasi |
| B | SD matritsa | Katta scope |
| C | Skip → prices | Chrome teshigi |

**Pick:** A.

## How (builder)

1. FE prefs/grid; contract kengaytirish.
2. Seed faqat smoke total=0 bo‘lsa (aks holda skip).
3. Smoke + parity `#13` Done.
