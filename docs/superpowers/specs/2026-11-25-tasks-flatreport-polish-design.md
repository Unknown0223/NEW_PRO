# #9 Отчёт по задачам — FlatReport polish (A)

**Date:** 2026-11-25  
**Status:** approved (user «a toliq qilibber» 2026-11-25)  
**SalesDoc:** `/report/tasksReport`  
**SALEC:** `/reports/tasks` · API `tasks`

## Intent / why

Отчёт parity #9: topshiriqlar jadvali ishlashi (filter-options 500, bo‘sh total) va FlatReport chrome standartiga yetishi; keyin #10.

## Goals

- FlatReport adapter qoladi (dedicated workspace yo‘q).
- Filter-options: `clients.code` → `client_code` (42703 tuzatiladi).
- FE chrome: `tablePrefsId: "report.tasks.v1"`, `filterGridCols: 6`, jadvalda `completed_at` (export bilan sync).
- Lokal seed `tenant_tasks` (title `TASK-SEED-*`) — report `total > 0`.
- Smoke: filter-options / report / export; contract test; sifat gate.

## Non-goals

- Dedicated workspace / status cards / timeline.
- Yangi date_type (faqat `created_at` davri).
- Commit/deploy (so‘ralmaguncha).

## Anti-goals

- Picker labeliga kod qo‘shish (kod faqat `searchText`).
- FlatReportni buzib alohida workspace.

## Constraints

- Fayl ≤400 LOC; lint:errors / BE tsc / audit:max-loc.
- Доступ `reports.otchet_po_zadacham` o‘zgartirilmaydi.

## Approaches

| | Variant | Trade-off |
|---|---------|-----------|
| **A (tanlangan)** | FlatReport polish + bugfix + seed | Tez; oilaga mos |
| B | Dedicated workspace | Ortacha chrome uchun ortiqcha |
| C | Faqat probe | Sekinroq |

**Pick:** A.

## How (builder)

1. BE `tasks-report.filters.ts`: `c.client_code AS code` (yoki map `client_code`).
2. FE `page.tsx`: prefs, grid, `completed_at` ustuni + formatter.
3. Seed skript + smoke.
4. Contract + filter pure test; parity jadvalida #9 → done.
