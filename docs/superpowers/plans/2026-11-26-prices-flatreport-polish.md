# #14 Prices FlatReport polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `/reports/prices` to FlatReport chrome parity (prefs, grid 9, no filter search) and mark #14 Done.

**Architecture:** Keep thin `FlatReportPage` + existing `prices` API. FE chrome Task 1; optional seed Task 2 if total=0; Task 3 smoke + parity. No SD matrix.

**Tech Stack:** Next.js FlatReport, Fastify/Prisma, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-26-prices-flatreport-polish-design.md`

## Global Constraints

- Fayl ≤400 LOC; `lint:errors` FE; `audit:max-loc`.
- Picker labels: faqat nom; kod faqat `searchText`.
- Доступ `reports.po_cenam` o‘zgartirilmaydi.
- Commit/deploy faqat so‘ralganda.
- Matritsa / Virtual Pivot / trade filtr yo‘q.

## Review Focus

- `tablePrefsId: "report.prices.v1"` va `filterGridCols: 9`.
- Filtrda `kind:"search"` yo‘q; `clientTableSearch` bor.
- dateRange + multiSelect placeholders (Тип цены / Категория / Бренд / Товар) saqlanadi.
- Export 200 + tokensiz 401.

## File map

| Path | Role |
|------|------|
| `frontend/app/(dashboard)/reports/prices/page.tsx` | Chrome: prefs, grid, drop search |
| `frontend/tests/prices-flatreport.contract.test.ts` | Source contract |
| `docs/superpowers/plans/2026-11-24-salesdoc-otchot-parity.md` | #14 Done |
| `docs/superpowers/plans/2026-11-25-otchot-tezyuk-status-va-etirozlar.md` | Holat |

---

### Task 1: FE chrome + contract

**Files:**
- Modify: `frontend/app/(dashboard)/reports/prices/page.tsx`
- Create: `frontend/tests/prices-flatreport.contract.test.ts`

**Interfaces:**
- Produces: `tablePrefsId: "report.prices.v1"`, `filterGridCols: 9`, no `kind: "search"`, `clientTableSearch` kept

- [x] **Step 1–4:** contract RED→GREEN; prefs/grid; search olib tashlandi
- [x] **Step 5: Commit** — skip (so‘ralmagan)

---

### Task 2: Seed (faqat total=0)

**Files:**
- Create only if needed: `backend/scripts/seed-prices-report-demo.ts`

- [x] **Step 1:** total=0 → seed kerak
- [x] **Step 2:** `seed-prices-report-demo.ts` — 2 schedules; second run OK; report total=2
- [x] **Step 3: Commit** — skip

---

### Task 3: Smoke + parity docs

**Files:**
- Modify: `docs/superpowers/plans/2026-11-24-salesdoc-otchot-parity.md`
- Modify: `docs/superpowers/plans/2026-11-25-otchot-tezyuk-status-va-etirozlar.md`

- [x] **Step 1: Smoke** — 200/200/200 + 401; total=2
- [x] **Step 2: Sifat** — lint/audit/contract
- [x] **Step 3: Mark parity** — #14 Done; next = `outlet-class`
- [x] **Step 4: Commit** — skip
