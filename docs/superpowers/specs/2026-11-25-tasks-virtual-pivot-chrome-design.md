# Tasks Virtual Pivot — full konstruktor chrome (A)

**Date:** 2026-11-25  
**Status:** approved (user «nima qilsang ham toliq ishlaydigan qilibber»)  
**Extends:** `2026-11-25-tasks-virtual-pivot-design.md`

## Goals

- `/reports/tasks` toolbar konstruktor bilan bir xil: Экспорт (Excel/CSV/PDF/HTML), Копировать, Стиль, Формат даты, Формат ячеек, Опции (layout), Поля, На весь экран.
- Pivot export via `usePivotExport` (ekranda ko‘rinadigan virtual jadval).
- Fullscreen workspace; Fields/Format/Date dialoglari ishlaydi.
- Dataset + filtrlar saqlanadi.

## Non-goals

- Server-side «Сохранить отчёт» (report-builder saved) — 1-wave skip; localStorage slice ixtiyoriy.
- Slice templates (KPI агента…) — sales-only, tasks uchun yo‘q.
- Builder faylini 2000 qatorga tasks dataset tiqish.

## How

1. `virtual-pivot-toolbar-button.tsx` + `tasks-pivot-toolbar.tsx`
2. Workspace: toolbar + dialogs + PivotTable ref (copy)
3. Contract: toolbar labels present
