# #9 Отчёт по задачам — Virtual Pivot (A)

**Date:** 2026-11-25  
**Status:** approved (user «ha» 2026-11-25)  
**SalesDoc:** `/report/tasksReport` (virtual flat grid)  
**SALEC:** `/reports/tasks`

## Intent / why

SalesDoc tasks hisoboti Virtual Pivot (табличная форма) — FlatReport parity yetarli emas; foydalanuvchi konstruktor uslubidagi virtual jadvalni so‘raydi.

## Goals

- `/reports/tasks` FlatReport o‘rniga **Virtual Pivot** (`layoutForm: "flat"`).
- Yangi **tasks dataset** API (qatorlar `tenant_tasks` + joinlar) — report-builder `orders_sales_lines` ga aralashtirilmaydi.
- Default flat ustunlar (SalesDoc): ID задачиДАЧИ, ЗАДАЧА, КЛИЕНТ, НАЗНАЧАЮЩИЙ, ИСПОЛНИТЕЛЬ, СТАТУС, КОММЕНТАРИЙ, ПРИМЕЧАНИЕ/результат, ФОТО (count), ТИП, ПРИОРИТЕТ, ДАТА СОЗДАНИЯ, СРОК, ЗАВЕРШЕНА.
- Toolbar: Поля, Экспорт, layout (Табличная), filtrlar (sana + status/assignee/…).
- Mavjud `usePivot` + `PivotTable` + Fields modal qayta ishlatiladi (2000-qatorli `VirtualPivotReportBuilder` to‘liq nusxa qilinmaydi — yupqa `TasksVirtualPivotWorkspace`).
- Доступ `reports.otchet_po_zadacham` saqlanadi.
- Contract: page Virtual Pivot; FlatReportPage yo‘q.

## Non-goals

- Umumiy report-builder ga `tenant_tasks` dataset qo‘shish (keyinroq mumkin).
- Classic cube aggregatsiya (SUM) — default flat; classic ixtiyoriy keyin.
- Рейтинг / фото preview binary (SalesDoc yulduz/rasm) — 1-wave’da yo‘q; `photo_count` matn/son.
- Commit/deploy so‘ralmaguncha.

## Anti-goals

- FlatReportni CSS bilan «pivotga o‘xshatish».
- To‘liq `VirtualPivotReportBuilder` fork (orders dataset bog‘liqligi).

## Constraints

- Fayl ≤400 LOC (workspace bo‘laklarga).
- lint:errors / BE tsc / audit:max-loc.
- Picker labels: faqat nom.

## Approaches

| | | |
|---|---|---|
| **A** | Dedicated tasks Virtual Pivot + dataset | Tanlangan |
| B | Deep-link konstruktor | Rad |
| C | FlatReport cosmetic | Rad |

**Pick:** A (user 2026-11-25).

## How (builder)

1. BE: `GET .../reports/tasks/dataset` (yoki mavjud report `limit` yuqori) — flat row objects + `fields` metadata; filter-options qoladi.
2. FE: `TasksVirtualPivotWorkspace` — filtr → fetch rows → `usePivot(raw, fields, flat default)` → `PivotTable` + Fields/Export.
3. `page.tsx` → workspace; eski FlatReport contract yangilanadi.
4. Seed allaqachon bor (`TASK-SEED-*`); smoke dataset + UI.

## Open (builder call)

- Saved pivot configs for tasks — 1-wave **skip** (Faqat runtime slice); Сохранить keyinroq.
- Photo thumb cell — 1-wave **count only**.
