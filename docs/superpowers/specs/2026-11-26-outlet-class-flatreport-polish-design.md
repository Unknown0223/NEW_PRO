# #15 Классификация ТТ — FlatReport polish (A)

**Date:** 2026-11-26  
**Status:** approved via Native (user 2026-11-26)  
**SALEC:** `/reports/outlet-class` · API `outlet-class`  
**Доступ:** `reports.klassifikatsiya_tt` — o‘zgartirilmaydi

## Goals

- `tablePrefsId: "report.outlet-class.v1"` + `filterGridCols: 9`
- Territory: Зона / Область / Город
- Filtr `kind: "search"` olib tashlash; `clientTableSearch` qoladi
- `group_by` selectga `placeholder: "Группировка"` (ko‘rinadigan nom)
- bands / dateRange / statuses / agents / client_categories saqlanadi
- Smoke + contract + parity #15 Done

## Non-goals

- Band formula o‘zgartirish; Virtual Pivot; commit/deploy so‘ralmaguncha

## Pick

**A** — FlatReport chrome (#12 oilasi).
