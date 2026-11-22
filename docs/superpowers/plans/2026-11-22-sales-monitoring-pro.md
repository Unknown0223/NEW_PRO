# Sales Monitoring Pro UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/dashboard/sales-monitoring` page body with NEW_PRO `sales.tsx` UI 1:1, fed by existing sales-monitoring APIs via an adapter (AppShell unchanged).

**Architecture:** Mirror Finance Pro: pure `buildSalesProUiModel(MonitoringSnapshot) → SalesProUiModel`, presentational `sales-monitoring/pro/*` components, thin wire in `monitoring-page` / `dashboard-sales-monitoring`. No new backend endpoints in this plan.

**Tech Stack:** Next.js (frontend), React Query (existing), Recharts, scoped CSS, Vitest for adapter.

**Spec:** `docs/superpowers/specs/2026-11-22-sales-monitoring-pro-design.md`

## Global Constraints

- New files ≤400 LOC (`npm run audit:max-loc`).
- Picker labels: name only (no codes in titles/chips).
- No zip mock seed data in production UI; missing API fields → empty states.
- Keep AppShell; only dashboard content + filter chrome styling.
- Quality gate after substantive edits: `npm run lint:errors --prefix frontend`, `npm run typecheck --prefix frontend`, `npm run audit:max-loc`.

## Review Focus

- Empty/partial snapshot (summary loaded, tables empty) must not crash charts or invent numbers.
- `execution_pct` / money strings parse safely (`null` → "—" or 0% display per adapter rules, never `NaN`).
- Branch/agent row labels show names only (codes only in searchText if needed).
- Detail dialog open/close does not trap focus or leave portal under charts (z-index / portal like Finance).
- Month filter change clears stale detail view and re-fetches without showing previous month’s fact as current.

## File map

- Create: `frontend/components/dashboard/sales-monitoring/sales-ui-model.ts` — adapter
- Create: `frontend/components/dashboard/sales-monitoring/pro/sales-pro-types.ts`
- Create: `frontend/components/dashboard/sales-monitoring/pro/sales-pro-theme.css`
- Create: `frontend/components/dashboard/sales-monitoring/pro/sales-pro-format.ts`
- Create: `frontend/components/dashboard/sales-monitoring/pro/sales-pro-shared.tsx`
- Create: `frontend/components/dashboard/sales-monitoring/pro/sales-pro-summary-cards.tsx`
- Create: `frontend/components/dashboard/sales-monitoring/pro/sales-pro-dynamics-chart.tsx`
- Create: `frontend/components/dashboard/sales-monitoring/pro/sales-pro-category-donut.tsx`
- Create: `frontend/components/dashboard/sales-monitoring/pro/sales-pro-kpi-panels.tsx`
- Create: `frontend/components/dashboard/sales-monitoring/pro/sales-pro-tables.tsx`
- Create: `frontend/components/dashboard/sales-monitoring/pro/sales-pro-details-dialog.tsx`
- Create: `frontend/components/dashboard/sales-monitoring/pro/sales-pro-page.tsx`
- Create: `frontend/tests/sales-ui-model.test.ts`
- Modify: `frontend/components/dashboard/monitoring/monitoring-page.tsx` — render Pro page + keep queries/filters
- Modify: `frontend/components/dashboard/dashboard-sales-monitoring.tsx` — only if re-export path changes
- Reference (do not paste wholesale): zip `src/sections/sales.tsx`, Finance `finance/pro/*`

---

### Task 1: SalesPro types + adapter (TDD)

**Files:**
- Create: `frontend/components/dashboard/sales-monitoring/pro/sales-pro-types.ts`
- Create: `frontend/components/dashboard/sales-monitoring/sales-ui-model.ts`
- Test: `frontend/tests/sales-ui-model.test.ts`

**Interfaces:**
- Consumes: `MonitoringSnapshot` from `frontend/components/dashboard/monitoring/types.ts`
- Produces: `buildSalesProUiModel(input: Partial<MonitoringSnapshot> | null): SalesProUiModel`
- `SalesProUiModel` must include at least: `plan`, `fact`, `completionPct`, `akb`, `okb`, `days: { label; plan; fact; completion }[]`, `categoryRows: { name; amount; pct; color }[]`, `branchRows`, `directionRows`, `agentRows` (map supervisor_performance → agent-like rows if no agent table), `averageTicket`, `periodLabel`

- [ ] **Step 1: Write the failing test**

```ts
// frontend/tests/sales-ui-model.test.ts
import { buildSalesProUiModel } from "@/components/dashboard/sales-monitoring/sales-ui-model";

it("maps plan_fact and akb_okb into summary fields", () => {
  const model = buildSalesProUiModel({
    plan_fact: { plan_sales: "1000", fact_sales: "800", execution_pct: 80, plan_note: "" },
    akb_okb: { akb: 40, okb: 100, coverage_pct: 40 },
    daily_sales: [{ day: "2026-11-01", sales_sum: "100", orders_count: 2 }],
    category_sales: [{ category: "A", sales_sum: "800", share_pct: 100 }],
    branch_performance: [],
    trade_directions: [],
    supervisor_performance: [],
    period: { from: "2026-11-01", to: "2026-11-30" }
  });
  expect(model.plan).toBe(1000);
  expect(model.fact).toBe(800);
  expect(model.completionPct).toBe(80);
  expect(model.akb).toBe(40);
  expect(model.okb).toBe(100);
  expect(model.categoryRows[0]?.name).toBe("A");
});

it("null snapshot yields zeros and empty arrays (no throw)", () => {
  const model = buildSalesProUiModel(null);
  expect(model.plan).toBe(0);
  expect(model.days).toEqual([]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test --prefix frontend -- sales-ui-model.test.ts`
Expected: FAIL (module/export missing)

- [ ] **Step 3: Implement types + `buildSalesProUiModel`**

Signature: `export function buildSalesProUiModel(input: Partial<MonitoringSnapshot> | null): SalesProUiModel`
Parse money strings with existing finance-style decimal helper or local `Number`/`parseFloat` that treats invalid as 0. Assign stable colors to categories (palette constant). Map `daily_sales` → `days` with plan distributed only if API has daily plan; else `plan: 0` per day and overall plan from `plan_fact` (document in adapter comment — do not invent daily plan).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test --prefix frontend -- sales-ui-model.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add frontend/components/dashboard/sales-monitoring/pro/sales-pro-types.ts frontend/components/dashboard/sales-monitoring/sales-ui-model.ts frontend/tests/sales-ui-model.test.ts
git commit -m "$(cat <<'EOF'
Add sales-monitoring Pro UI model adapter.

EOF
)"
```

---

### Task 2: Pro theme + shared chrome

**Files:**
- Create: `frontend/components/dashboard/sales-monitoring/pro/sales-pro-theme.css`
- Create: `frontend/components/dashboard/sales-monitoring/pro/sales-pro-format.ts`
- Create: `frontend/components/dashboard/sales-monitoring/pro/sales-pro-shared.tsx`

**Interfaces:**
- Consumes: zip `index.css` sales/panel tokens (scoped under `.sales-pro` like `.finance-pro`)
- Produces: `formatSalesMoney`, `formatSalesPct`, `downloadSalesProCsv`, `SalesProPanel` wrapper; CSS with `overflow: visible`, no retained blur, stacking `z-0` content / popovers high (calendar/date if any)

- [ ] **Step 1: Add scoped theme CSS** — copy only sales-relevant rules from zip CSS into `.sales-pro { … }`; fix any syntax so Next CSS load does not 500.

- [ ] **Step 2: Add format + shared helpers** — money/pct/csv mirroring `finance-pro-format` / `finance-pro-shared` APIs but sales-named.

- [ ] **Step 3: Verify CSS parses** — open or compile path that imports the CSS; no `Unexpected }` / build error.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/dashboard/sales-monitoring/pro/sales-pro-theme.css frontend/components/dashboard/sales-monitoring/pro/sales-pro-format.ts frontend/components/dashboard/sales-monitoring/pro/sales-pro-shared.tsx
git commit -m "$(cat <<'EOF'
Add sales-monitoring Pro theme and shared helpers.

EOF
)"
```

---

### Task 3: Summary, charts, tables, details, page shell

**Files:**
- Create: `sales-pro-summary-cards.tsx`, `sales-pro-dynamics-chart.tsx`, `sales-pro-category-donut.tsx`, `sales-pro-kpi-panels.tsx`, `sales-pro-tables.tsx`, `sales-pro-details-dialog.tsx`, `sales-pro-page.tsx` under `…/pro/`

**Interfaces:**
- Consumes: `SalesProUiModel`, format/shared from Task 2
- Produces: `SalesProPage({ model, loading, monthLabel }: SalesProPageProps): JSX.Element`
- Detail views: union `SalesProDetailView` covering template kinds that have data (`plan` | `sales` | `okb` | `categories` | `branches` | `directions` | `agents` | `dynamics` | `allocation`); branch/agent-by-id only if rows have stable ids — otherwise list-only details

- [ ] **Step 1: Implement presentational sections** — layout order matches zip: filters slot (children or props), allocation trigger optional, 4 summary cards, dynamics + donut row, 3 KPI panels, branch/direction/agent tables.

- [ ] **Step 2: Implement details dialog** — portal + high z-index; CSV export buttons; empty copy when arrays empty.

- [ ] **Step 3: Assemble `SalesProPage`** — import theme CSS once; wire `onOpenDetail`.

- [ ] **Step 4: Typecheck touched paths**

Run: `npm run typecheck --prefix frontend`
Expected: no new errors in sales-monitoring/pro

- [ ] **Step 5: Commit**

```bash
git add frontend/components/dashboard/sales-monitoring/pro/
git commit -m "$(cat <<'EOF'
Add sales-monitoring Pro page UI sections.

EOF
)"
```

---

### Task 4: Wire monitoring page + filter chrome

**Files:**
- Modify: `frontend/components/dashboard/monitoring/monitoring-page.tsx`
- Optionally slim unused old chart/table JSX (delete only if unused after wire; prefer render swap first)

**Interfaces:**
- Consumes: existing React Query hooks (`use-monitoring-queries`), `buildSalesProUiModel`, `SalesProPage`
- Produces: page that merges summary+charts+tables into one snapshot object, passes model to `SalesProPage`; keeps apply/draft filters working

- [ ] **Step 1: Merge query data into `Partial<MonitoringSnapshot>`** and `useMemo(() => buildSalesProUiModel(merged), [merged])`.

- [ ] **Step 2: Replace main content body with `<div className="sales-pro"><SalesProPage … /></div>`**; keep filter bar above or inside page head; restyle filter chrome toward template (segmented controls / panel) without removing filter fields.

- [ ] **Step 3: Manual smoke** — with `start-dev` running, open `/dashboard/sales-monitoring`, confirm KPIs non-NaN and tables render for current month.

- [ ] **Step 4: Quality gate**

Run:
```bash
npm run lint:errors --prefix frontend
npm run typecheck --prefix frontend
npm run audit:max-loc
```
Expected: all pass (or only pre-existing unrelated failures noted)

- [ ] **Step 5: Commit**

```bash
git add frontend/components/dashboard/monitoring/monitoring-page.tsx frontend/components/dashboard/sales-monitoring/
git commit -m "$(cat <<'EOF'
Wire sales-monitoring Pro UI to existing dashboard APIs.

EOF
)"
```

---

## Spec coverage (self-review)

| Spec goal | Task |
|---|---|
| 1:1 sales UI (cards/charts/tables/details) | 3 |
| Existing API / adapter, no mock seed | 1, 4 |
| AppShell unchanged | 4 (content only) |
| Filter chrome + scope kept | 4 |
| LOC / lint / picker names | Global + Task 4 gate |
| Empty API → empty UI | Task 1 null test + Review Focus |

## Execution note

Commits in tasks assume the human asked for commits; if they said no commits, skip Step “Commit” and leave changes unstaged.
