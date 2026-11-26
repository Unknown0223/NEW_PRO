# Tasks Pivot Shared Chrome (A) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/reports/tasks` Format/Options/Fields openings 1:1 with konstruktor via shared chrome; tasks Apply uses `buildTasksFlatPivotConfig` / `buildTasksClassicPivotConfig` (compact = classic zones + compact flags).

**Architecture:** Extract «Настройки разметки» dialog + Формат dropdown into shared report components. `VirtualPivotReportBuilder` and `TasksVirtualPivotWorkspace` both consume them; each supplies its own `onApply` zone logic. Tasks gains viewMode chart, conditional formatting dialog, hierarchy toggle; Отчёты/Сохр./Поделиться — follow-up 2026-11-26 (`tasks_report`).

**Tech Stack:** Next.js client components, `@salec/pivot-engine`, existing `VirtualPivot*` dialogs, `PivotChart`, Vitest source contracts.

**Spec:** `docs/superpowers/specs/2026-11-26-tasks-pivot-chrome-shared-design.md`

## Global Constraints

- Fayl ≤400 LOC (`npm run audit:max-loc`); yangi fayllar allowlistsiz.
- Picker labels: faqat nom (`.cursor/rules/picker-labels.mdc`).
- Tasks dataset/filters o‘zgarmaydi; Доступ `reports.otchet_po_zadacham*` saqlanadi.
- Отчёты / Сохр. как / slice templates — follow-up 2026-11-26 (`TasksPivotSavedChrome`, datasetId `tasks_report`).
- Commit/deploy faqat user so‘raganda (steplarda commit → skip unless asked).
- Sifat: `npm run lint:errors --prefix frontend`; `audit:max-loc`; tasks contract Vitest.

## Review Focus

- Options Apply on tasks with empty classic values → still COUNT(task_id) via `buildTasksClassicPivotConfig`, not empty cube.
- Compact layout → same zones as classic + `layoutForm: "compact"` / `compactMode: true`.
- Format → Диаграмма with no chartable values → empty chart message, no crash.
- Hierarchy Развер. disabled when `layoutForm === "flat"` or no expandable keys.
- Builder Options Apply still uses flatten/restore (not tasks builders).

---

### Task 1: Tasks layout Apply helper + tests

**Files:**
- Modify: `frontend/components/reports/tasks/tasks-pivot-fields.ts`
- Test: `frontend/tests/tasks-virtual-pivot.contract.test.ts`

**Interfaces:**
- Produces:
  - `export type LayoutOptionsSelection = { layoutForm: "flat" | "classic" | "compact"; grandTotals: "none" | "both" | "rows" | "columns"; subtotals: "none" | "both" | "rows" | "columns" }`
  - `export function applyTasksLayoutOptions(from: PivotConfig | undefined, sel: LayoutOptionsSelection): PivotConfig` — flat → `buildTasksFlatPivotConfig`; classic → `buildTasksClassicPivotConfig(from)` then merge grand/subtotal flags + `layoutForm`; compact → classic zones + `layoutForm: "compact"`, `compactMode: true`, same totals flags; always `drillDown` boolean set.

- [ ] **Step 1: Write failing tests**

```ts
it("applyTasksLayoutOptions flat resets SalesDoc flat columns", async () => {
  const { applyTasksLayoutOptions, TASKS_DEFAULT_FLAT_FIELD_IDS } = await import(
    "../components/reports/tasks/tasks-pivot-fields"
  );
  const cfg = applyTasksLayoutOptions(undefined, {
    layoutForm: "flat",
    grandTotals: "none",
    subtotals: "none"
  });
  expect(cfg.options.layoutForm).toBe("flat");
  expect(cfg.rows).toEqual([...TASKS_DEFAULT_FLAT_FIELD_IDS]);
});

it("applyTasksLayoutOptions compact keeps COUNT and compact flags", async () => {
  const { applyTasksLayoutOptions } = await import(
    "../components/reports/tasks/tasks-pivot-fields"
  );
  const cfg = applyTasksLayoutOptions(undefined, {
    layoutForm: "compact",
    grandTotals: "both",
    subtotals: "both"
  });
  expect(cfg.options.layoutForm).toBe("compact");
  expect(cfg.options.compactMode).toBe(true);
  expect(cfg.values[0]?.aggregation).toBe("COUNT");
  expect(cfg.options.showGrandTotal).toBe(true);
});
```

- [ ] **Step 2: Run** `cd frontend && npx vitest run tests/tasks-virtual-pivot.contract.test.ts`  
  Expected: FAIL (export missing)

- [ ] **Step 3: Implement `applyTasksLayoutOptions` in `tasks-pivot-fields.ts`**

Map `grandTotals`/`subtotals` exactly like builder `applyOptions` flags (`showGrandTotal`, `showColumnTotals`, `showSubtotals`, `subtotalScope`).

- [ ] **Step 4: Run** — Expected: PASS

- [ ] **Step 5: Commit** — skip unless asked

---

### Task 2: Shared «Настройки разметки» dialog

**Files:**
- Create: `frontend/components/reports/virtual-pivot-layout-options-dialog.tsx`
- Test: `frontend/tests/virtual-pivot-layout-options.contract.test.ts`

**Interfaces:**
- Consumes: none from Task 1 (selection type may live in this file or shared types — prefer define `LayoutOptionsSelection` here and re-export from tasks-fields import, OR duplicate the type alias in tasks-fields importing from dialog file)
- Produces:
  - `export type LayoutOptionsSelection = { ... }` (canonical)
  - `export function VirtualPivotLayoutOptionsDialog(props: { open: boolean; onOpenChange: (o: boolean) => void; initial: LayoutOptionsSelection; onApply: (sel: LayoutOptionsSelection) => void }): JSX.Element`
  - Copy/UI: title `Настройки разметки`, buttons `Применить` / `Отмена`, groups Общий итог / Промежуточный итог / Разметки with same radio labels as builder (`LAYOUT_FORM_OPTIONS` includes Компактная / Классическая / Табличная). Arena inline styles ported from builder dialog block.

- [ ] **Step 1: Failing contract** — file contains `Настройки разметки`, `Компактная форма`, `Применить`, exports `VirtualPivotLayoutOptionsDialog`

- [ ] **Step 2: Run** `cd frontend && npx vitest run tests/virtual-pivot-layout-options.contract.test.ts` — FAIL

- [ ] **Step 3: Implement dialog** — extract OptionGroup pattern from builder; no zone mutation inside dialog

- [ ] **Step 4: Run** — PASS; `npm run audit:max-loc` — OK

- [ ] **Step 5: Commit** — skip unless asked

**Note:** Task 1 may import `LayoutOptionsSelection` from this file — if Task 1 already defined the type locally, refactor to single export here in this task.

---

### Task 3: Shared Формат menu

**Files:**
- Create: `frontend/components/reports/virtual-pivot-format-menu.tsx`
- Modify: `frontend/tests/virtual-pivot-layout-options.contract.test.ts` (or new `virtual-pivot-format-menu.contract.test.ts`)

**Interfaces:**
- Produces:
  - `export function VirtualPivotFormatMenu(props: { open: boolean; onOpenCellFormat: () => void; onOpenConditional: () => void; onViewTable: () => void; onViewChart: () => void; onToggleColumnTotals: () => void }): JSX.Element | null`
  - Labels exactly: `Формат ячеек…`, `Условное форматирование…`, `Таблица`, `Диаграмма`, `Итоги по столбцам` (builder copy)

- [ ] **Step 1: Failing contract** — asserts those five strings + export name

- [ ] **Step 2–4: Implement + PASS**

- [ ] **Step 5: Commit** — skip unless asked

---

### Task 4: Wire konstruktor builder to shared chrome

**Files:**
- Modify: `frontend/components/reports/virtual-pivot-report-builder.tsx`
- Test: `frontend/tests/virtual-pivot-layout-options.contract.test.ts` (assert builder imports `VirtualPivotLayoutOptionsDialog` and `VirtualPivotFormatMenu`)

**Interfaces:**
- Consumes: Task 2–3 components
- Builder `onApply`: keep existing `applyOptions` body (flatten/restore); open dialog sets `initial` from current config the same way `openOptions` does today; replace inline Format dropdown JSX with `VirtualPivotFormatMenu`

- [ ] **Step 1: Failing contract** — builder source matches `/VirtualPivotLayoutOptionsDialog/` and `/VirtualPivotFormatMenu/` and no longer contains inline title-only duplicate if moved (still OK if strings only in shared file)

- [ ] **Step 2: Refactor builder** — remove local Options Dialog JSX + format menu list; wire shared

- [ ] **Step 3: Run contracts** — PASS; `npm run lint:errors --prefix frontend` on touched files if needed

- [ ] **Step 4: Commit** — skip unless asked

---

### Task 5: Wire tasks workspace + toolbar 1:1 openings

**Files:**
- Modify: `frontend/components/reports/tasks/tasks-pivot-toolbar.tsx`
- Modify: `frontend/components/reports/tasks/tasks-virtual-pivot-workspace.tsx`
- Modify: `frontend/tests/tasks-virtual-pivot.contract.test.ts`

**Interfaces:**
- Consumes: `VirtualPivotLayoutOptionsDialog`, `VirtualPivotFormatMenu`, `applyTasksLayoutOptions`, `VirtualPivotConditionalDialog`, `PivotChart`, `hasChartableData`, `toggleColumnTotals` from `usePivot` if exposed (else updateConfig options)
- Toolbar: remove 2-item Options dropdown; `onOpenOptions` callback; Format menu uses shared component; add hierarchy toggle props (`hierarchyExpanded`, `onToggleHierarchy`, `hierarchyDisabled`) matching builder left strip placement
- Workspace: `viewMode` state; conditional dialog; Options open → layout dialog → `updateConfig(applyTasksLayoutOptions(config, sel))`; chart branch like builder; expand/collapse via existing `usePivot` expandAll/collapseAll

- [ ] **Step 1: Extend failing contract**

```ts
it("tasks openings match konstruktor chrome", () => {
  const tb = readFileSync(..., "tasks-pivot-toolbar.tsx", "utf8");
  const ws = readFileSync(..., "tasks-virtual-pivot-workspace.tsx", "utf8");
  expect(tb).not.toMatch(/Табличная форма/); // options moved to dialog
  expect(ws).toMatch(/VirtualPivotLayoutOptionsDialog/);
  expect(ws).toMatch(/VirtualPivotFormatMenu|Условное форматирование/);
  expect(ws).toMatch(/VirtualPivotConditionalDialog/);
  expect(ws).toMatch(/PivotChart|viewMode/);
  expect(ws).toMatch(/applyTasksLayoutOptions/);
  expect(ws).toMatch(/Настройки разметки|VirtualPivotLayoutOptionsDialog/);
});
```

- [ ] **Step 2: Run** — FAIL

- [ ] **Step 3: Implement toolbar + workspace wiring**

- [ ] **Step 4: Run tasks + layout contracts** — PASS

- [ ] **Step 5: Commit** — skip unless asked

---

### Task 6: Sifat gate

**Files:** none new

- [ ] **Step 1:** `npm run lint:errors --prefix frontend` — exit 0
- [ ] **Step 2:** `npm run audit:max-loc` — OK
- [ ] **Step 3:** `cd frontend && npx vitest run tests/tasks-virtual-pivot.contract.test.ts tests/virtual-pivot-layout-options.contract.test.ts` (+ format menu test file if separate) — all PASS
- [ ] **Step 4:** Manual note for reviewer: `/reports/tasks` → Формат (5 band) → Опции dialog → Поля; compare `/reports/...` konstruktor Options dialog look

---

## Self-review (spec coverage)

| Spec item | Task |
|-----------|------|
| Shared Options dialog 1:1 | 2, 4 |
| Format menu full bands | 3, 4, 5 |
| Tasks Apply path 2 (flat/classic builders) | 1, 5 |
| Chart + conditional | 5 |
| Hierarchy toggle | 5 |
| Builder regression shared | 4 |
| No Отчёты/Сохранить | constraints |
| LOC / contracts | 2, 6 |
