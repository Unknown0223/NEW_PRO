# #15 Outlet-class FlatReport polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or subagent-driven-development.

**Goal:** `/reports/outlet-class` FlatReport chrome parity (prefs, grid 9, Зона/Область/Город, no filter search).

**Architecture:** Thin FlatReportPage + existing API. FE Task 1; seed Task 2 if total=0; Task 3 smoke + parity.

**Tech Stack:** Next.js FlatReport, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-26-outlet-class-flatreport-polish-design.md`

## Global Constraints

- ≤400 LOC; lint:errors; audit:max-loc; picker faqat nom; commit so‘ralmaguncha yo‘q.

## Review Focus

- prefs/grid; Зона/Область/Город; no `kind:"search"`; `clientTableSearch` bor; Группировка placeholder.

## File map

| Path | Role |
|------|------|
| `frontend/app/(dashboard)/reports/outlet-class/page.tsx` | Chrome |
| `frontend/tests/outlet-class-flatreport.contract.test.ts` | Contract |
| `docs/superpowers/plans/2026-11-24-salesdoc-otchot-parity.md` | #15 Done |
| `docs/superpowers/plans/2026-11-25-otchot-tezyuk-status-va-etirozlar.md` | Holat |

---

### Task 1: FE chrome + contract

- [ ] Step 1: failing contract — prefs, grid 9, Зона/Область/Город, Группировка, NOT search, clientTableSearch
- [ ] Step 2: vitest FAIL
- [ ] Step 3: update page.tsx
- [ ] Step 4: vitest PASS
- [ ] Step 5: commit skip unless asked

### Task 2: Seed (faqat total=0)

- [ ] Step 1: smoke total; skip if > 0
- [ ] Step 2: seed only if needed

### Task 3: Smoke + parity

- [ ] Step 1: filter-options / report / export 200; 401
- [ ] Step 2: lint + audit + contract
- [ ] Step 3: parity #15 Done; next expeditor-visits yoki menyu
