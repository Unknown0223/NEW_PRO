# #12 Visits FlatReport polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `/reports/visits` to FlatReport chrome parity (prefs, grid, Зона/Область/Город, no filter search) with local visit metrics for review.

**Architecture:** Keep thin `FlatReportPage` + existing `visits` API. FE-only chrome for Task 1; Task 2 idempotent seed for `agent_visits` + planned CAA so `visited`/`planned` > 0; Task 3 smoke + parity mark. No new `date_type` (BE has none).

**Tech Stack:** Next.js FlatReport, Fastify/Prisma, Vitest, Prisma seed script.

**Spec:** `docs/superpowers/specs/2026-11-26-visits-flatreport-polish-design.md`

## Global Constraints

- Fayl ≤400 LOC; `lint:errors` FE; BE `tsc --noEmit`; `audit:max-loc`.
- Picker labels: faqat nom; kod faqat `searchText`.
- Доступ `reports.po_vizitam` o‘zgartirilmaydi.
- Commit/deploy faqat so‘ralganda.
- `visits-2` / `visit-totals` / `universal-visits` tegilmaydi.

## Review Focus

- Filtrda `kind:"search"` qaytib kelmasin; jadval qidiruvi ishlaydi.
- Territory placeholderlari «Территория N» emas — Зона/Область/Город.
- Seed qayta ishga tushganda dublikat agent_visits qatorlari bo‘lmasin (idempotent note/prefix).
- Report `total > 0` va kamida bitta qatorda `visited > 0` yoki `planned > 0`.
- Export 200 + token siz 401.

## File map

| Path | Role |
|------|------|
| `frontend/app/(dashboard)/reports/visits/page.tsx` | Chrome: prefs, grid, territory labels, drop search |
| `frontend/tests/visits-flatreport.contract.test.ts` | Source contract |
| `backend/scripts/seed-visits-report-demo.ts` | Idempotent visit + plan seed |
| `docs/superpowers/plans/2026-11-24-salesdoc-otchot-parity.md` | #12 Done |
| `docs/superpowers/plans/2026-11-25-otchot-tezyuk-status-va-etirozlar.md` | Holat |

---

### Task 1: FE chrome + contract

**Files:**
- Modify: `frontend/app/(dashboard)/reports/visits/page.tsx`
- Create: `frontend/tests/visits-flatreport.contract.test.ts`

**Interfaces:**
- Consumes: existing `FlatReportConfig` / `FlatReportPage`
- Produces: `tablePrefsId: "report.visits.v1"`, `filterGridCols: 9`, territory placeholders Зона/Область/Город, no `kind: "search"`

- [ ] **Step 1: Write failing contract** in `visits-flatreport.contract.test.ts` — assert `FlatReportPage`, `tablePrefsId: "report.visits.v1"`, `filterGridCols: 9`, placeholders Зона/Область/Город, `clientTableSearch`, NOT `Территория [123]`, NOT `kind: "search"`, NOT `dateTypeAsRadio`

- [ ] **Step 2: Run** `cd frontend && npx vitest run tests/visits-flatreport.contract.test.ts` — Expected: FAIL

- [ ] **Step 3: Update** `visits/page.tsx` — add prefs/grid; rename territory placeholders; remove search filter field; keep columns/totals/exportPermission

- [ ] **Step 4: Run** same vitest — Expected: PASS

- [ ] **Step 5: Commit** (faqat so‘ralganda) — `feat(reports): polish visits FlatReport chrome`

---

### Task 2: Idempotent visit metrics seed

**Files:**
- Create: `backend/scripts/seed-visits-report-demo.ts`

**Interfaces:**
- Consumes: tenant `aksit` (or `SEED_TENANT_SLUG`), agent with orders (reuse ship-seed agent if present)
- Produces: script exit 0; after run, `GET …/visits?from=&to=` has row with `visited > 0` and `planned > 0` in current month window

- [ ] **Step 1: Write script** — find/create agent+client; upsert `client_agent_assignments` with visit weekday/plan for today; insert `agent_visits` marked `VISITS-SEED-` in note (or equivalent unique guard); skip if already seeded

- [ ] **Step 2: Run** `cd backend && npx tsx scripts/seed-visits-report-demo.ts` — Expected: exit 0; second run no duplicate rows

- [ ] **Step 3: Commit** (faqat so‘ralganda) — `chore(seed): visits report demo metrics`

---

### Task 3: Smoke + parity docs

**Files:**
- Modify: `docs/superpowers/plans/2026-11-24-salesdoc-otchot-parity.md`
- Modify: `docs/superpowers/plans/2026-11-25-otchot-tezyuk-status-va-etirozlar.md`

**Interfaces:**
- Consumes: Task 1–2 working locally
- Produces: #12 marked Done; smoke evidence

- [ ] **Step 1: Smoke** — login → `filter-options` 200; `visits?from=…&to=…` total>0 + visited/planned; `export` 200; no token → 401

- [ ] **Step 2: Sifat** 

```bash
npm run lint:errors --prefix frontend
cd backend && npx tsc -p tsconfig.json --noEmit
npm run audit:max-loc
cd frontend && npx vitest run tests/visits-flatreport.contract.test.ts
```

- [ ] **Step 3: Mark parity** — table row `#12 По визитам | visits | /report/agent/visit | Done`; Task 7 checkbox; status doc #12 Done; next = #13+ remaining stubs

- [ ] **Step 4: Commit** (faqat so‘ralganda) — `docs: mark visits #12 FlatReport polish done`
