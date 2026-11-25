# Tasks Virtual Pivot (#9 rewrite) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (or subagent-driven-development). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace `/reports/tasks` FlatReport with Virtual Pivot flat table fed by a tasks dataset, matching SalesDoc virtual grid chrome.

**Architecture:** BE adds `GET /reports/tasks/dataset` → `{ fields, rows, total }` (cap 5000). FE `TasksVirtualPivotWorkspace` loads filter-options + dataset, runs `usePivot(rows, fields, flat default)`, renders `PivotTable` + Fields modal + existing Excel export. Thin `page.tsx`.

**Tech Stack:** `@salec/pivot-engine`, `usePivot`, `PivotTable`, FlatReportFilters shell, Fastify tasks report module.

**Spec:** `docs/superpowers/specs/2026-11-25-tasks-virtual-pivot-design.md`

## Global Constraints

- Fayl ≤400 LOC; lint:errors; BE tsc; audit:max-loc.
- Picker labels: faqat nom.
- Доступ `reports.otchet_po_zadacham` o‘zgarmaydi.
- Commit/deploy faqat so‘ralganda.
- Saved pivot configs — skip (1-wave).

## Review Focus

- Empty dataset → PivotTable empty state, no crash.
- Flat default columns include task_id, title, client_name, status_label.
- Fields modal can hide/show columns; layout stays flat.
- Export still uses existing xlsx route (RBAC).
- Page no longer imports FlatReportPage.

---

### Task 1: BE tasks dataset + fields metadata

**Files:**
- Create: `backend/src/modules/reports/tasks-report.dataset.ts`
- Modify: `backend/src/modules/reports/tasks-report.service.ts` (re-export)
- Modify: `backend/src/modules/reports/reports.route.tasks.ts`
- Test: `backend/tests/tasks-report.pure.test.ts`

**Produces:**
- `TASKS_PIVOT_FIELDS: Array<{ id, label, dataType }>`
- `getTasksReportDataset(tenantId, filters, actor) → { fields, rows: Record[], total, truncated }`
  - rows from `getTasksReport` with `limit=min(5000,…)`, `page=1`
  - each row plain object with field ids
- Route: `GET /api/:slug/reports/tasks/dataset` (same query schema as report)

- [x] **Step 1:** Failing test — `TASKS_PIVOT_FIELDS` includes `task_id`, `title`, `status_label`
- [x] **Step 2:** Implement dataset module + route
- [x] **Step 3:** Tests pass

---

### Task 2: FE TasksVirtualPivotWorkspace

**Files:**
- Create: `frontend/components/reports/tasks/tasks-pivot-fields.ts`
- Create: `frontend/components/reports/tasks/tasks-filter-config.ts`
- Create: `frontend/components/reports/tasks/tasks-virtual-pivot-workspace.tsx`
- Modify: `frontend/app/(dashboard)/reports/tasks/page.tsx`
- Modify: `frontend/tests/tasks-flatreport.contract.test.ts` → rename/replace with virtual-pivot contract
- Modify: `frontend/tests/flat-report-page.m1.1.contract.test.ts` — remove tasks from wave3Adapters; assert Virtual Pivot

**Produces:** Workspace with FlatReportFilters, dataset query, `usePivot` flat default (`layoutForm: "flat"`, rows = default field ids), PivotTable, Fields button (`VirtualPivotFieldsModal`), Export button (blob from `/export`).

- [x] **Step 1:** Failing contract — page has TasksVirtualPivotWorkspace, not FlatReportPage
- [x] **Step 2:** Implement fields + workspace + page
- [x] **Step 3:** Contracts pass

---

### Task 3: Smoke + sifat — DONE

- [x] Smoke: filter-options, dataset (rows≥1 with seed), export
- [x] lint:errors; BE tsc; audit:max-loc
- [x] Update parity note: #9 Virtual Pivot rewrite
- [x] Chrome + Options (Табличная/Классическая); classic default COUNT(task_id)
- E’tirozlar: `2026-11-25-otchot-tezyuk-status-va-etirozlar.md`

## Execution

User approved design «ha» → inline executing-plans. Shipped in branch push 2026-11-25.
