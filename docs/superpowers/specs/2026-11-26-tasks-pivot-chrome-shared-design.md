# Tasks Virtual Pivot — shared konstruktor chrome (A)

**Date:** 2026-11-26  
**Status:** approved (user «ha» 2026-11-26)  
**Approach:** A — extract shared pivot chrome; tasks keeps dataset/filters  
**Layout Apply (tasks):** **2** — dialog UI 1:1; zones via `buildTasksFlatPivotConfig` / `buildTasksClassicPivotConfig` (compact = classic zones + `layoutForm: compact`)  
**Extends:** `2026-11-25-tasks-virtual-pivot-design.md`, `2026-11-25-tasks-virtual-pivot-chrome-design.md`

## Intent / why

`/reports/tasks` toolbar **ochilishlari** (Формат menyu, Опции → «Настройки разметки», Поля, Формат даты, Формат ячеек, va shu menyudagi bandlar) konstruktor (`VirtualPivotReportBuilder`) bilan **1:1** bo‘lishi kerak. Hozir tasks’da Опции 2-bandli dropdown; Формат’da faqat «Формат ячеек…». Foydalanuvchi A ni tanladi: bitta shared chrome, ikkala joyda bir xil ochilish.

## Goals

- Tasks va konstruktor **bir xil** right-side chrome ochilishlari:
  - **Формат** menyu: Формат ячеек…; Условное форматирование…; Таблица / Диаграмма; Итоги по столбцам
  - **Опции** → dialog **«Настройки разметки»** (Общий итог / Промежуточный итог / Разметки: Компактная | Классическая | Табличная) + Применить/Отмена — Arena layout
  - **Формат даты**, **Поля** (`VirtualPivotFieldsModal`), **На весь экран** — mavjud shared dialoglar
- Left chrome (Экспорт Excel/CSV/PDF/HTML, Копировать, Стиль) tasks’da saqlanadi; export menyusiga PNG faqat chart view’da (konstruktor kabi)
- Shared modul(lar) ≤400 LOC; konstruktor builder shu modulni chaqiradi (duplication yo‘q)
- Tasks dataset/filter shell o‘zgarmaydi (`GET .../tasks/dataset`, FlatReportFilters)

## Non-goals

- **Отчёты / Сохр. как / saved pivot API** — follow-up 2026-11-26: `tasks_report` datasetId + share dialog
- Sales-only **шаблоны среза** (KPI агента…) — tasks’da yo‘q
- Builder fayliga tasks SQL/filtr tiqish (C rad etilgan)
- WDR / Excel-online host — tegilmaydi

## Anti-goals

- Tasks’da «оʻxshash» lekin boshqa Options dropdown qoldirish
- Konstruktor UI’ni buzib tasks uchun fork qilish
- LOC >400 yangi fayllarda allowlistsiz

## Approaches considered

| | Yondashuv | Trade-off |
|---|-----------|-----------|
| **A (tanlangan)** | Shared chrome extract; tasks + builder consume | Bir manba 1:1; extract ishi |
| B | Faqat tasks’ga copy | Tez, lekin drift |
| C | Tasks → to‘liq ReportBuilder | Saqlash keladi; filtr/API chalkash |

## Design

### Shared surface

Yangi (yoki split) modullar `frontend/components/reports/`:

1. **`virtual-pivot-layout-options-dialog.tsx`** — «Настройки разметки» UI + `applyLayoutOptions(config, { grandTotals, subtotals, layoutForm }, fields)` pure helper (flat leave/restore mantiq konstruktor’dagi `applyOptions` dan)
2. **`virtual-pivot-format-menu.tsx`** — Формат dropdown bandlari (callbacks: openCellFormat, openConditional, setViewMode, toggleColumnTotals)
3. **`virtual-pivot-workspace-toolbar.tsx`** (ixtiyoriy birlashtirish) — left+right toolbar strip; props orqali `showSavedReports?: boolean` (tasks=false), `showHierarchyToggle?: boolean` (tasks=true faqat classic/compact’da), `showSliceTemplates?: boolean` (tasks=false)

Agar bitta fayl 400 dan oshsa — toolbar / options / format alohida qoladi (builder call).

### Tasks wiring

`tasks-virtual-pivot-workspace.tsx`:

- `viewMode` table|chart; chart render konstruktor’dagi `PivotChart` (yoki mavjud chart komponent) + empty chart xabar
- Conditional format dialog (`VirtualPivotConditionalFormatDialog` / format-dialogs) + `config.options.conditionalFormats`
- Options: dropdown o‘rniga shared layout dialog (**Настройки разметки**)
- Format menyu: to‘liq 1:1 bandlar
- Classic/compact: hierarchy Развер./Сверн. (konstruktor kabi), flat’da disabled
- **Применить (tasks):** grand/subtotal bayroqlari dialogdan; **zonalar** — flat → `buildTasksFlatPivotConfig`; classic → `buildTasksClassicPivotConfig`; compact → classic zones + `layoutForm: "compact"` / `compactMode: true`. Konstruktor `restoreFromPreFlatSnapshot` tasks Apply’da **ishlatilmaydi**.

`tasks-pivot-toolbar.tsx` — shared toolbar’ga o‘tadi yoki yupqa wrapper.

### Konstruktor Apply (o‘zgarmaydi)

Builder shared dialogni ishlatadi; Apply path hali `flattenConfigZones` / `restoreFromPreFlatSnapshot` (hozirgi mantiq). Shared dialog props: `onApply(selection)` — consumer o‘zi zonani yig‘adi.

### Konstruktor wiring

`virtual-pivot-report-builder.tsx` Options dialog + Format dropdown JSX → shared komponentlarga almashtiriladi; behavior regression yo‘q (contract/smoke).

### Permissions

- Tasks export: mavjud `reports.otchet_po_zadacham.export` (yoki joriy page perm)
- Saved/share tugmalari tasks’da ko‘rinmaydi

### Verification

- FE contract: tasks page Format menyuda «Условное форматирование» + Options dialog title «Настройки разметки»; layoutForm compact option
- Builder regression: Options dialog hali ochiladi
- `lint:errors`, FE typecheck (yangi fayllar), BE tsc (agar tegilmasa skip), `audit:max-loc`
- Manual: tasks → Формат / Опции / Поля ochilishlari konstruktor bilan bir xil

## Builder calls (tekshirish uchun)

- Fayl split LOC ≤400
- Chart import path — konstruktor’dagi mavjud komponent
- Hierarchy toggle joylashuvi — konstruktor left strip bilan bir xil
- Conditional apply → `updateConfig` + `options.conditionalFormats`
- Shared dialog faqat selection qaytaradi; Apply zonasi consumer’da (tasks vs builder farqi)

## Out of this wave (keyingi)

- Отчёты / Сохранить / share
- Tasks-specific slice templates
