# #13b Daily-visits FlatReport polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `/reports/daily-visits` to FlatReport chrome parity (prefs, grid 9, Год/Месяц kept) and mark #13 Done in parity docs.

**Architecture:** Keep thin `FlatReportPage` + existing `daily-visits` API (year/month, flat rows). FE chrome Task 1; optional seed Task 2 only if report total=0; Task 3 smoke + parity. No matrix rewrite.

**Tech Stack:** Next.js FlatReport, Fastify/Prisma, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-26-daily-visits-flatreport-polish-design.md`

## Global Constraints

- Fayl ≤400 LOC; `lint:errors` FE; BE `tsc` daily-visits scope; `audit:max-loc`.
- Picker labels: faqat nom; kod faqat `searchText`.
- Доступ `reports.po_dnevnomu_poseshcheniyu` o‘zgartirilmaydi.
- Commit/deploy faqat so‘ralganda.
- Matritsa / Virtual Pivot / `visits*` boshqa sahifalar tegilmaydi.

## Review Focus

- `tablePrefsId: "report.daily-visits.v1"` va `filterGridCols: 9` bor.
- Год/Месяц placeholder + oy RU nomlari (Январь…Декабрь) saqlanadi.
- Filtrda `kind:"search"` yo‘q; jadval `clientTableSearch` bor.
- `dateTypeAsRadio` / `dateRange` qo‘shilmaydi.
- Export 200 + tokensiz 401.

## File map

| Path | Role |
|------|------|
| `frontend/app/(dashboard)/reports/daily-visits/page.tsx` | Chrome: prefs + grid |
| `frontend/tests/daily-visits-flatreport.contract.test.ts` | Source contract (kengaytirish) |
| `backend/src/modules/reports/daily-visits-report.month-options.ts` | Oy RU (mavjud) |
| `docs/superpowers/plans/2026-11-24-salesdoc-otchot-parity.md` | #13 Done |
| `docs/superpowers/plans/2026-11-25-otchot-tezyuk-status-va-etirozlar.md` | Holat |

---

### Task 1: FE chrome + contract

**Files:**
- Modify: `frontend/app/(dashboard)/reports/daily-visits/page.tsx`
- Modify: `frontend/tests/daily-visits-flatreport.contract.test.ts`

**Interfaces:**
- Consumes: existing `FlatReportConfig` / `FlatReportPage`
- Produces: `tablePrefsId: "report.daily-visits.v1"`, `filterGridCols: 9`; keeps Год/Месяц; no `kind: "search"`; no `dateTypeAsRadio`

- [x] **Step 1: Extend failing assertions** in `daily-visits-flatreport.contract.test.ts`
- [x] **Step 2: Run** vitest — FAIL (prefs/grid) ✓
- [x] **Step 3: Update** `daily-visits/page.tsx` — `tablePrefsId` + `filterGridCols: 9`
- [x] **Step 4: Run** vitest — PASS ✓
- [x] **Step 5: Commit** — skip (so‘ralmagan)

---

### Task 2: Seed (faqat total=0)

**Files:**
- Create only if needed: `backend/scripts/seed-daily-visits-report-demo.ts`

**Interfaces:**
- Skip if `GET …/daily-visits?year=&month=` already `total > 0`
- Else: idempotent demo rows for current UTC month (reuse visits-seed patterns / agent 42 if present)

- [x] **Step 1: Smoke check** total — **SKIP seed** (2026-11 lokal `total=14`)
- [x] **Step 2: (only if 0)** — n/a
- [x] **Step 3: Commit** — n/a (seed yo‘q)

---

### Task 3: Smoke + parity docs

**Files:**
- Modify: `docs/superpowers/plans/2026-11-24-salesdoc-otchot-parity.md`
- Modify: `docs/superpowers/plans/2026-11-25-otchot-tezyuk-status-va-etirozlar.md`

**Interfaces:**
- Produces: #13 marked Done; next = prices (#14)

- [x] **Step 1: Smoke** — filter-options 200 + `11:Ноябрь`; report 200 total=14; export 200; 401
- [x] **Step 2: Sifat** — lint:errors clean; audit OK; FE 2 + BE 4 pass
- [x] **Step 3: Mark parity** — #13 Done; next = `prices`
- [x] **Step 4: Commit** — skip (so‘ralmagan)
