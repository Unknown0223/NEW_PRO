# #12b Visits drill-down modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add SalesDoc-style metric drill-down on `/reports/visits`: clickable ОКБ/АКБ/Отказы/Фото/Непосещ./Посещ. open a modal of client rows from `GET …/visits/detail`.

**Architecture:** Backend `getVisitsReportDetail(tenantId, filters, { agent_id, type })` returns capped client-grain rows filtered by SD `type`. FE keeps FlatReportPage; widen `formatters` to `ReactNode` and wire clickable buttons on metric columns; `VisitsDetailModal` fetches detail with the same applied filters + agent_id + type.

**Tech Stack:** Fastify/Prisma, Next.js FlatReport, shadcn Dialog, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-26-visits-drilldown-modal-design.md`

## Global Constraints

- Fayl ≤400 LOC; lint:errors FE; BE `tsc --noEmit`; audit:max-loc.
- Picker/modal labels: faqat nom (kod emas).
- Доступ `reports.po_vizitam` o‘zgartirilmaydi; detail `reportViewPreHandler`.
- Dual-header % / order-sum click / agent-name click — **non-goal**.
- Commit/deploy faqat so‘ralganda.
- `visits-2` / `visit-totals` / `universal-visits` tegilmaydi.

## Review Focus

- `type` noto‘g‘ri / noma’lum → 400; agent_id yo‘q → 400.
- Metric qiymat `0` → link yo‘q (click ochilmaydi).
- Detail javobida `truncated` + `total` (cap 2000).
- Modal filtrlar asosiy hisobot `from`/`to`/statuses/territory/visit_kinds bilan bir xil.
- Tokensiz detail → 401.

## File map

| Path | Role |
|------|------|
| `backend/.../visits-report.types.ts` | Detail type union + row shape |
| `backend/.../visits-report.detail.ts` | SQL per type |
| `backend/.../visits-report.parse.ts` | parse detail query |
| `backend/.../visits-report.service.ts` | re-export |
| `backend/.../reports.route.visits.ts` | `GET …/detail` |
| `backend/src/contracts/reports.schemas.ts` | detail schema |
| `backend/tests/visits-report.detail.pure.test.ts` | type allowlist + parse |
| `frontend/.../flat-report/types.ts` | formatters → ReactNode |
| `frontend/.../visits/visits-detail-modal.tsx` | Dialog + table |
| `frontend/.../visits/visits-metric-link.tsx` | clickable cell |
| `frontend/app/.../visits/page.tsx` | formatters + modal state |
| `frontend/tests/visits-drilldown.contract.test.ts` | FE contract |

---

### Task 1: BE detail types + parse + pure tests

**Files:**
- Modify: `backend/src/modules/reports/visits-report.types.ts`
- Modify: `backend/src/modules/reports/visits-report.parse.ts`
- Create: `backend/tests/visits-report.detail.pure.test.ts`

**Interfaces:**
- Produces:
  - `VisitsDetailType = "okb" | "only_order" | "rejected" | "only_photo" | "not_visited" | "visited"`
  - `VisitsDetailFilters = VisitsReportFilters & { agent_id: number; type: VisitsDetailType }` (page/limit unused or fixed)
  - `VisitsDetailRow = { client_id; client_name; visited_at; order_sum; refusal_label; photo_count; inventory_label; last_purchase_sum; last_purchase_at }`
  - `parseVisitsDetailQuery(q) → VisitsDetailFilters` — maps empty/`okb` → `okb`; rejects unknown type; requires agent_id ≥ 1

- [ ] **Step 1: Write failing tests** — `parseVisitsDetailQuery` accepts types; empty string → okb; unknown → throw/invalid; missing agent_id → invalid

- [ ] **Step 2: Run** `cd backend && npx vitest run tests/visits-report.detail.pure.test.ts` — FAIL

- [ ] **Step 3: Implement types + parse helpers**

- [ ] **Step 4: Run** same vitest — PASS

- [ ] **Step 5: Commit** (faqat so‘ralganda) — `feat(reports): parse visits detail drill-down query`

---

### Task 2: BE detail SQL + route

**Files:**
- Create: `backend/src/modules/reports/visits-report.detail.ts`
- Modify: `backend/src/modules/reports/visits-report.service.ts`
- Modify: `backend/src/modules/reports/reports.route.visits.ts`
- Modify: `backend/src/contracts/reports.schemas.ts` — `visitsDetailQuerySchema`

**Interfaces:**
- Consumes: Task 1 parse/types; shared client/territory filters from `visits-report.report.ts` (extract or duplicate minimal)
- Produces: `getVisitsReportDetail(tenantId, f, actor) → { rows: VisitsDetailRow[]; total; truncated; limit: 2000 }`
  - `okb`: CAA planned clients for agent
  - `only_order`: clients with ≥1 non-cancelled order in range for agent
  - `rejected`: refusal rows/clients in range
  - `only_photo`: photo-report clients in range
  - `visited`: distinct agent_visits clients in range
  - `not_visited`: planned minus visited_planned
- Route: `GET /api/:slug/reports/visits/detail` + `reportViewPreHandler`

- [ ] **Step 1: Extend pure test** — export `VISITS_DETAIL_TYPES` includes six types; detail module exports `getVisitsReportDetail`

- [ ] **Step 2: Implement detail SQL + wire route/schema**

- [ ] **Step 3: Run** `npx vitest run tests/visits-report.detail.pure.test.ts` + `npx tsc -p tsconfig.json --noEmit` — PASS (no new errors in visits files)

- [ ] **Step 4: Smoke** login → detail `type=visited&agent_id=<seed>` 200 rows≥0; bad type 400; no token 401

- [ ] **Step 5: Commit** (faqat so‘ralganda) — `feat(reports): visits detail drill-down API`

---

### Task 3: FE modal + clickable metrics

**Files:**
- Modify: `frontend/components/reports/flat-report/types.ts` — `formatters` return `React.ReactNode`
- Create: `frontend/components/reports/visits/visits-metric-link.tsx`
- Create: `frontend/components/reports/visits/visits-detail-modal.tsx`
- Modify: `frontend/app/(dashboard)/reports/visits/page.tsx` — client wrapper with modal state + formatters for `okb|akb|refusals|photo_reports|not_visited|visited`
- Create: `frontend/tests/visits-drilldown.contract.test.ts`
- Modify: `frontend/tests/visits-flatreport.contract.test.ts` if page grows (keep chrome asserts)

**Interfaces:**
- Consumes: detail API; FlatReportPage `formatters`
- Produces: click when `Number(value) > 0` opens modal; title `Сумма: {agent_name}` or SD-like `{typeLabel}: {agent}`; table columns match spec; loading/empty states

- [ ] **Step 1: Write failing FE contract** — page/workspace mentions `VisitsDetailModal`, `visits/detail`, metric keys; modal file exports component

- [ ] **Step 2: Run** `cd frontend && npx vitest run tests/visits-drilldown.contract.test.ts` — FAIL

- [ ] **Step 3: Implement modal + metric link + page formatters** (page may become thin client component wrapping FlatReportPage)

- [ ] **Step 4: Run** vitest drilldown + visits-flatreport contracts — PASS

- [ ] **Step 5: Sifat**

```bash
npm run lint:errors --prefix frontend
cd backend && npx tsc -p tsconfig.json --noEmit
npm run audit:max-loc
```

- [ ] **Step 6: Commit** (faqat so‘ralganda) — `feat(reports): visits metric drill-down modal`

---

### Task 4: Docs parity note

**Files:**
- Modify: `docs/superpowers/plans/2026-11-24-salesdoc-otchot-parity.md` — #12 note: drill-down modal 2026-11-26
- Modify: `docs/superpowers/plans/2026-11-25-otchot-tezyuk-status-va-etirozlar.md`
- Modify: `tmp/salesdoc-reports-probe/pages/visits/ANALYSIS.md` (optional local) — skip if gitignored friction; prefer docs only

- [ ] **Step 1: Mark** #12b drill-down done in status/parity
- [ ] **Step 2: Commit** (faqat so‘ralganda) — `docs: visits drill-down modal parity`
