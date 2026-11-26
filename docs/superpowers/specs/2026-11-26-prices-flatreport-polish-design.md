# #14 По ценам — FlatReport polish (A)

**Date:** 2026-11-26  
**Status:** approved (user «ha» 2026-11-26)  
**SalesDoc:** `/report/price`  
**SALEC:** `/reports/prices` · API `prices`  
**Доступ:** `reports.po_cenam` (view/export) — o‘zgartirilmaydi

## Intent / why

Отчёт parity #14: wave-2 FlatReport bor; chrome parity (#12/#13 uslubi) va parity Done yo‘q. Filtr `search` + jadval qidiruvi dublikat.

## Goals

- FlatReport adapter qoladi (flat list; SD dinamik matritsa emas).
- `tablePrefsId: "report.prices.v1"` + `filterGridCols: 9`.
- Filtr `kind: "search"` olib tashlanadi; `clientTableSearch` qoladi.
- dateRange + price_types / categories / brands / products saqlanadi.
- Smoke: filter-options / report / export 200; tokensiz 401.
- Contract + parity `#14` Done; next = outlet-class / qolgan stublar.

## Non-goals

- SalesDoc dinamik sana-ustun matritsa.
- Virtual Pivot / trade (`trades`) filtr (ANALYSIS v1 gap).
- `daily-visits` / boshqa otchotlarga tegish.
- Commit/deploy (so‘ralmaguncha).

## Anti-goals

- Picker labeliga kod (`Name (code)`).
- Faqat docs belgilash.

## Constraints

- ≤400 LOC; lint:errors / audit:max-loc; BE daily/prices scope.
- Picker: faqat nom; kod `searchText`.

## Approaches

| | Variant | Trade-off |
|---|---------|-----------|
| **A (tanlangan)** | Chrome prefs/grid + search drop + contract + parity | #12/#13 oilasi |
| B | SD matritsa | Katta scope |
| C | Skip | Teshik |

**Pick:** A.

## How (builder)

1. FE prefs/grid; search olib tashlash; contract.
2. Seed faqat smoke total=0 bo‘lsa.
3. Smoke + parity `#14` Done.
