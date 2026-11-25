# #10 По бонусам — FlatReport polish (A)

**Date:** 2026-11-25  
**Status:** approved (user «a tafsiyang bian toliq qilibber» 2026-11-25)  
**SalesDoc:** `/report/bonusReport`  
**SALEC:** `/reports/bonuses` · API `bonuses`

## Intent / why

Отчёт parity #10: bonus qatorlari (`oi.is_bonus`) jadvali chrome + shipped sana parity; review bo‘sh bo‘lmasin.

## Goals

- FlatReport adapter qoladi (`group_by` dynamic columns saqlanadi).
- `dateTypeAsRadio` + `tablePrefsId: "report.bonuses.v1"` + `filterGridCols: 6`.
- `shipped_date` → `COALESCE(sl.shipped_at, sl.delivered_at)` (shared `STATUS_CTE`).
- Lokal seed: `order_items.is_bonus=true` (aksit) — report `total > 0`.
- Smoke + contract; parity jadvalida #10 done.

## Non-goals

- Dedicated matrix workspace.
- Universal-bonuses (`/reports/universal-bonuses`) — alohida navbat.
- Commit/deploy (so‘ralmaguncha).

## Anti-goals

- Picker labeliga kod.
- `group_by` dinamikasini olib tashlash.

## Constraints

- ≤400 LOC; lint:errors / BE tsc / audit:max-loc.
- Доступ `reports.po_bonusam` o‘zgartirilmaydi.

## Approaches

| | Variant | Trade-off |
|---|---------|-----------|
| **A (tanlangan)** | FlatReport polish + COALESCE + seed | Tez; inventory oilasi |
| B | Dedicated workspace | Ortacha |
| C | Faqat probe | Sekin |

**Pick:** A.

## How (builder)

1. `bonuses.dates.ts` + shared STATUS_CTE; wire report.
2. FE page chrome.
3. Seed script + smoke + contract + parity mark.
