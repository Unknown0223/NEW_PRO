# Bonuses FlatReport polish (#10) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `/reports/bonuses` to FlatReport chrome parity with shipped COALESCE and local `is_bonus` seed for review.

**Architecture:** Keep thin `FlatReportPage` + dynamic `group_by` columns. Extract `bonusesDateExpr`. Reuse shared `STATUS_CTE` (includes `delivered_at`). Idempotent seed marks/creates bonus order lines with prefix note `BONUS-SEED-`.

**Tech Stack:** Next.js FlatReport, Fastify/Prisma, Vitest, Prisma seed script.

**Spec:** `docs/superpowers/specs/2026-11-25-bonuses-flatreport-polish-design.md`

## Global Constraints

- Fayl ≤400 LOC; lint:errors; BE tsc; audit:max-loc.
- Picker labels: faqat nom.
- Commit/deploy faqat so‘ralganda.
- Доступ `reports.po_bonusam` o‘zgartirilmaydi.

## Review Focus

- `date_type=shipped_date` with only `delivered_at` → still matches.
- Non-bonus lines excluded (`is_bonus=true` only).
- FE still FlatReportPage; prefs/radios/grid present.
- Seed re-run idempotent.

---

### Task 1: BE bonusesDateExpr + STATUS_CTE

**Files:**
- Create: `backend/src/modules/reports/bonuses.dates.ts`
- Modify: `backend/src/modules/reports/bonuses-report.report.ts`
- Modify: `backend/tests/bonuses-report.pure.test.ts`

- [x] Failing test for COALESCE shipped
- [x] Implement + wire shared STATUS_CTE
- [x] Pass test

---

### Task 2: FE chrome + contract

**Files:**
- Modify: `frontend/app/(dashboard)/reports/bonuses/page.tsx`
- Create: `frontend/tests/bonuses-flatreport.contract.test.ts`

Produces: `tablePrefsId: "report.bonuses.v1"`, `dateTypeAsRadio: true`, `filterGridCols: 6`, FlatReportPage, group_by columns.

---

### Task 3: Seed + smoke + parity

**Files:**
- Create: `backend/scripts/seed-bonuses-report-demo.ts`
- Modify: `docs/superpowers/plans/2026-11-24-salesdoc-otchot-parity.md`

Smoke: filter-options / report total>0 / export. Sifat gate.

## Execution

User «toliq qilibber» → inline **executing-plans**.
