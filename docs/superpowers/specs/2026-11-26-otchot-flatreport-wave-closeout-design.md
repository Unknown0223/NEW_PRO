# Отчёт FlatReport wave close-out (#16+)

**Date:** 2026-11-26  
**Status:** approved via «davom etiribber toliq tugallab ber» + Native oilasi  
**Scope:** Barcha qolgan FlatReport adapterlar (prefs yo‘q yoki search/Территория N)

## Goals

Har bir target sahifada:
- `tablePrefsId: "report.<slug>.v1"` + `filterGridCols: 9`
- filtr `kind: "search"` olib tashlash (jadval `clientTableSearch` qoladi)
- `Территория 1/2/3` → Зона / Область / Город
- Bitta batch contract + asosiy smoke + parity #16+ Done

## Non-goals

- Virtual Pivot / custom workspace (staff-attendance, excel-export, photo, tasks, universal-bonuses, client-sales-2/4)
- Sariq stublar (tare, feedback, nr)
- Commit/deploy so‘ralmaguncha

## Pick

**A** — mexanik chrome polish (bir xil oila).
