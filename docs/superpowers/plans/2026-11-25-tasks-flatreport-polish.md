# Tasks FlatReport polish (#9) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/reports/tasks` usable (fix filter-options 500, seed rows) and match FlatReport chrome parity without a dedicated workspace.

**Architecture:** Keep thin `FlatReportPage` adapter. Fix clients SQL to `client_code`. Add prefs/grid/`completed_at`. Idempotent seed inserts `tenant_tasks` with title prefix `TASK-SEED-`.

**Tech Stack:** Next.js FlatReport, Fastify/Prisma report modules, Vitest, Prisma seed script.

**Spec:** `docs/superpowers/specs/2026-11-25-tasks-flatreport-polish-design.md`

## Global Constraints

- Fayl ≤400 LOC (`npm run audit:max-loc`).
- Sifat: `npm run lint:errors --prefix frontend`; `cd backend && npx tsc -p tsconfig.json --noEmit`; `npm run audit:max-loc`.
- Picker labels: faqat nom (kod `searchText`da).
- Commit/deploy faqat user so‘raganda.
- Доступ `reports.otchet_po_zadacham` o‘zgartirilmaydi.

## Review Focus

- filter-options 200 after `client_code` fix (no `c.code`).
- Seed titles `TASK-SEED-*` re-run deletes prior seed then inserts.
- FE still `FlatReportPage`; `completed_at` visible + formatted.
- Empty DB without seed → total 0 still OK; with seed → total > 0 in default date range.

---

### Task 1: BE client_code fix + pure test

**Files:**
- Modify: `backend/src/modules/reports/tasks-report.filters.ts`
- Modify: `backend/tests/tasks-report.pure.test.ts` (or add assert helper if SQL not unit-testable — assert via small exported `clientsFilterSelectSql` OR document smoke-only; prefer extracting SQL fragment)

**Preferred:** export a constant/helper for the clients select list so test can assert `client_code` and not `c.code`.

- [x] **Step 1: Write failing test** asserting filter clients SQL uses `client_code` not bare `c.code`
- [x] **Step 2: Run → FAIL**
- [x] **Step 3: Fix SQL `c.client_code AS code`**
- [x] **Step 4: Run → PASS**
- [x] **Step 5: Commit** — skip

---

### Task 2: FE FlatReport chrome + contract

**Files:**
- Modify: `frontend/app/(dashboard)/reports/tasks/page.tsx`
- Create: `frontend/tests/tasks-flatreport.contract.test.ts`

**Produces:** page has `FlatReportPage`, `tablePrefsId: "report.tasks.v1"`, `filterGridCols: 6`, column `completed_at` / `Завершена`, formatter for `completed_at`, still no dedicated workspace.

- [x] **Step 1: Failing contract test**
- [x] **Step 2: Run → FAIL**
- [x] **Step 3: Update page.tsx**
- [x] **Step 4: Run → PASS**
- [x] **Step 5: Commit** — skip

---

### Task 3: Seed + smoke + parity checklist

**Files:**
- Create: `backend/scripts/seed-tasks-report-demo.ts`
- Modify: `docs/superpowers/plans/2026-11-24-salesdoc-otchot-parity.md` (#9 done)

Seed: aksit tenant; delete titles `startsWith TASK-SEED-`; insert ≥4 tasks (open/in_progress/done/cancelled), mixed priority, link client+assignee+creator if present.

Smoke (local API `:18080`):
1. filter-options → 200, has statuses/assignees/clients
2. report last 12 months → total > 0
3. export → xlsx bytes > 0

Sifat gate: lint:errors, FE typecheck, BE tsc, audit:max-loc.

- [x] **Step 1: Write + run seed**
- [x] **Step 2: Smoke three endpoints**
- [x] **Step 3: Sifat gate**
- [x] **Step 4: Mark #9 done in parity plan**
- [x] **Step 5: Commit** — skip

## Execution handoff

User asked «a toliq qilibber» → inline **executing-plans** (no pause between tasks).
