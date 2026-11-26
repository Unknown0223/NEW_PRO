# #11 Universal Bonuses Virtual Pivot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/reports/universal-bonuses` FlatReport with a tasks-style Virtual Pivot over bonus **line** rows (`oi.is_bonus = true`).

**Architecture:** New `GET …/universal-bonuses/dataset` returns capped line grain + field metadata. FE thin workspace clones the tasks VP shell (filters → `usePivot` → `PivotTable` + shared chrome + saved reports with `datasetId: "universal_bonuses"`). `#10 bonuses` FlatReport and agregat `GET/export` routes stay; UI stops calling them.

**Tech Stack:** Fastify/Prisma SQL, Next.js client, `@salec/pivot-engine`, FlatReportFilters shell, Vitest contracts.

**Spec:** `docs/superpowers/specs/2026-11-26-universal-bonuses-virtual-pivot-design.md`

## Global Constraints

- Fayl ≤400 LOC (`npm run audit:max-loc`); yangi fayllar allowlistsiz.
- Picker labels: faqat nom.
- Доступ `reports.universalnyy_bonus` (view/export) o‘zgartirilmaydi.
- `#10` `/reports/bonuses` tegilmaydi.
- АКБ / «заказов» FlatReport agregatlari 1-wave’da yo‘q.
- Dataset `ORDER BY o.created_at DESC, o.id DESC, oi.id DESC`; cap `5000`.
- Saved/share: `reports.universalnyy_bonus.view` + `datasetId: "universal_bonuses"`.
- Commit/deploy faqat user so‘raganda (steplarda Commit → skip unless asked).
- Sifat: `npm run lint:errors --prefix frontend`; `cd backend && npx tsc -p tsconfig.json --noEmit`; `npm run audit:max-loc`.

## File map

| Path | Role |
|------|------|
| `backend/.../universal-bonuses-report.dataset.ts` | Line SQL + `UNIVERSAL_BONUSES_PIVOT_FIELDS` + `getUniversalBonusesReportDataset` |
| `backend/.../universal-bonuses-report.service.ts` | Re-export dataset |
| `backend/.../reports.route.universal-bonuses.ts` | `GET …/dataset` |
| `backend/tests/universal-bonuses-report.pure.test.ts` | Field + dataset shape assertions |
| `frontend/.../universal-bonuses/*` | filter-config, pivot-fields, toolbar, dialogs, saved-chrome, workspace |
| `frontend/app/(dashboard)/reports/universal-bonuses/page.tsx` | → workspace |
| `frontend/tests/universal-bonuses-virtual-pivot.contract.test.ts` | Page/workspace contract |
| `frontend/tests/universal-bonuses-flatreport.contract.test.ts` | Delete or rewrite → VP |
| `frontend/tests/flat-report-page.m1.1.contract.test.ts` | wave-4 universal-bonuses expectations → VP |
| `docs/superpowers/plans/2026-11-24-salesdoc-otchot-parity.md` | #11 = Virtual Pivot |
| `docs/superpowers/plans/2026-11-25-otchot-tezyuk-status-va-etirozlar.md` | Holat tuzatish |

## Review Focus

- `shipped_date` filter uses `COALESCE(sl.shipped_at, sl.delivered_at)` via `bonusesDateExpr` + `STATUS_CTE` (same as bonuses).
- Empty bonus lines → empty pivot, no crash; truncated banner when `total > rows.length`.
- Classic Options Apply with no values → COUNT default (tasks chrome rule), not blank cube.
- Saved list filters `dataset_id === "universal_bonuses"` (sales/tasks aralashmasin).
- Agent scope SQL still applied on dataset WHERE.

---

### Task 1: Backend line dataset + pure tests

**Files:**
- Create: `backend/src/modules/reports/universal-bonuses-report.dataset.ts`
- Modify: `backend/src/modules/reports/universal-bonuses-report.service.ts`
- Modify: `backend/tests/universal-bonuses-report.pure.test.ts`

**Interfaces:**
- Consumes: `BonusesReportFilters` / `parseBonusesReportQuery`, `bonusesDateExpr`, `STATUS_CTE`, `enrichScopedReportActor` / `buildScopedAgentExistsSql`, `ReportActor`
- Produces:
  - `export const UNIVERSAL_BONUSES_DATASET_CAP = 5000`
  - `export const UNIVERSAL_BONUSES_PIVOT_FIELDS: Array<{ id: string; label: string; dataType: "string" | "number" | "date" }>` — exact ids from spec: `order_id`, `order_status`, `product_name`, `sku`, `category_name`, `client_name`, `client_category`, `agent_name`, `qty`, `volume_m3`, `line_total`, `created_at`, `shipped_at`
  - `export async function getUniversalBonusesReportDataset(tenantId: number, f: BonusesReportFilters, actor?: ReportActor): Promise<{ fields: typeof UNIVERSAL_BONUSES_PIVOT_FIELDS; rows: Record<string, unknown>[]; total: number; truncated: boolean }>`

- [ ] **Step 1: Write failing tests** in `universal-bonuses-report.pure.test.ts`

```ts
import { UNIVERSAL_BONUSES_PIVOT_FIELDS } from "../src/modules/reports/universal-bonuses-report.dataset";

it("pivot fields match design starter ids", () => {
  expect(UNIVERSAL_BONUSES_PIVOT_FIELDS.map((f) => f.id)).toEqual([
    "order_id", "order_status", "product_name", "sku", "category_name",
    "client_name", "client_category", "agent_name", "qty", "volume_m3",
    "line_total", "created_at", "shipped_at"
  ]);
  expect(UNIVERSAL_BONUSES_PIVOT_FIELDS.find((f) => f.id === "qty")?.dataType).toBe("number");
});
```

- [ ] **Step 2: Run** `cd backend && npx vitest run tests/universal-bonuses-report.pure.test.ts`  
  Expected: FAIL (module missing)

- [ ] **Step 3: Implement `getUniversalBonusesReportDataset`**

Line grain: `orders` ⋈ `order_items` (`oi.is_bonus = true`) ⋈ `products` / `clients` / categories / agent / `STATUS_CTE` + `LEFT JOIN status_logs`. Reuse filter semantics from `bonuses-report.report.ts` `buildWhere` (extract shared helper **or** copy WHERE into dataset file if extract blows LOC — prefer small `bonuses-report.where.ts` only if both stay ≤400). Ignore `group_by` for row shape. Force `page: 1`, `limit: UNIVERSAL_BONUSES_DATASET_CAP`. Map `volume_m3 = oi.qty * COALESCE(p.volume_m3,0)`, `line_total = oi.line_total`, `shipped_at = COALESCE(sl.shipped_at, sl.delivered_at)`, `order_status = o.status`. `total` = full matching count; `truncated = total > rows.length`.

- [ ] **Step 4: Run** — Expected: PASS; re-export from `universal-bonuses-report.service.ts`

- [ ] **Step 5: Commit** — skip unless asked

---

### Task 2: Wire `GET …/universal-bonuses/dataset`

**Files:**
- Modify: `backend/src/modules/reports/reports.route.universal-bonuses.ts`
- Modify: `backend/src/modules/reports/universal-bonuses-report.service.ts` (if export incomplete)

**Interfaces:**
- Consumes: `getUniversalBonusesReportDataset`, `universalBonusesReportQuerySchema` / `parseReportQueryOr400`
- Produces: `GET /api/:slug/reports/universal-bonuses/dataset` → `{ data: dataset }` with `reportViewPreHandler`; forces dataset cap like tasks route.

- [ ] **Step 1: Add route** mirroring `reports.route.tasks.ts` dataset handler (before or after filter-options).

- [ ] **Step 2: Run** `cd backend && npx tsc -p tsconfig.json --noEmit`  
  Expected: exit 0 for changed files (project may have unrelated noise — no new errors in these paths).

- [ ] **Step 3: Commit** — skip unless asked

---

### Task 3: FE pivot fields + filter config + contracts

**Files:**
- Create: `frontend/components/reports/universal-bonuses/universal-bonuses-pivot-fields.ts`
- Create: `frontend/components/reports/universal-bonuses/universal-bonuses-filter-config.ts`
- Create: `frontend/tests/universal-bonuses-virtual-pivot.contract.test.ts`
- Delete or gut: `frontend/tests/universal-bonuses-flatreport.contract.test.ts`

**Interfaces:**
- Produces:
  - `UNIVERSAL_BONUSES_DEFAULT_FLAT_FIELD_IDS` — same 13 ids as BE
  - `UNIVERSAL_BONUSES_PIVOT_FIELDS: PivotField[]`
  - `buildUniversalBonusesFlatPivotConfig(base?: Partial<PivotConfig>): PivotConfig`
  - `buildUniversalBonusesClassicPivotConfig(from?: PivotConfig): PivotConfig` — ≥1 value (`SUM` on `qty` or `COUNT` on `order_id`)
  - `applyUniversalBonusesLayoutOptions(from, sel): PivotConfig` — same rules as `applyTasksLayoutOptions`
  - `selectionFromConfig(config): LayoutOptionsSelection`
  - `UNIVERSAL_BONUSES_FILTER_CONFIG` — `apiPath: "universal-bonuses"`, `exportPermission: "reports.universalnyy_bonus.export"`, `dateTypeAsRadio: true`, `filterGridCols: 6`, filterFields **without** `group_by` and **without** `kind: "search"`; dateRange + date_type + statuses/agents/categories/client_categories/territory_1..3

- [ ] **Step 1: Failing contract**

```ts
it("page will use UniversalBonusesVirtualPivotWorkspace", () => {
  // temporarily assert fields module exports until page wired in Task 5
});
it("flat builder lists design columns", async () => {
  const { buildUniversalBonusesFlatPivotConfig, UNIVERSAL_BONUSES_DEFAULT_FLAT_FIELD_IDS } =
    await import("../components/reports/universal-bonuses/universal-bonuses-pivot-fields");
  const cfg = buildUniversalBonusesFlatPivotConfig();
  expect(cfg.options.layoutForm).toBe("flat");
  expect(cfg.rows).toEqual([...UNIVERSAL_BONUSES_DEFAULT_FLAT_FIELD_IDS]);
});
it("filter config has no group_by or search field", () => {
  const src = readFileSync(..., "utf8");
  expect(src).not.toMatch(/paramKey:\s*["']group_by["']/);
  expect(src).not.toMatch(/kind:\s*["']search["']/);
});
```

- [ ] **Step 2: Run** `cd frontend && npx vitest run tests/universal-bonuses-virtual-pivot.contract.test.ts` — FAIL

- [ ] **Step 3: Implement fields + filter-config** (clone tasks helpers; classic default value `SUM`/`qty`)

- [ ] **Step 4: Run** — PASS; remove FlatReport-only contract expectations for this page

- [ ] **Step 5: Commit** — skip unless asked

---

### Task 4: Workspace shell (toolbar / dialogs / saved / workspace)

**Files:**
- Create: `frontend/components/reports/universal-bonuses/universal-bonuses-pivot-toolbar.tsx`
- Create: `frontend/components/reports/universal-bonuses/universal-bonuses-pivot-dialogs.tsx`
- Create: `frontend/components/reports/universal-bonuses/universal-bonuses-pivot-saved-chrome.tsx`
- Create: `frontend/components/reports/universal-bonuses/universal-bonuses-virtual-pivot-workspace.tsx`
- Modify: `frontend/lib/pivot-bridge.ts` — add `UNIVERSAL_BONUSES_PIVOT_DATASET_ID = "universal_bonuses"` (next to `TASKS_PIVOT_DATASET_ID`)

**Interfaces:**
- Consumes: Task 3 builders; shared `VirtualPivotLayoutOptionsDialog`, `VirtualPivotFormatMenu`, `VirtualPivotFieldsModal`, `TasksPivotToolbar`-shaped buttons, `SharePivotReportDialog`, `savePivotConfigReport(..., { datasetId })`
- Produces: `UniversalBonusesVirtualPivotWorkspace` — `FlatReportFilters` + fetch `GET /api/${slug}/reports/universal-bonuses/dataset?...` + `usePivot` + export via `usePivotExport`; permission `reports.universalnyy_bonus.export`; saved chrome filters `dataset_id === UNIVERSAL_BONUSES_PIVOT_DATASET_ID`

Keep each file ≤400 LOC. Prefer copy-adapt from `components/reports/tasks/*` rather than abstracting a generic shell in this wave.

- [ ] **Step 1: Extend contract** — workspace source must match `/reports/universal-bonuses/dataset`, `usePivot`, `UniversalBonusesPivotToolbar`, `applyUniversalBonusesLayoutOptions`, `UNIVERSAL_BONUSES_PIVOT_DATASET_ID` / saved chrome

- [ ] **Step 2: Run** — FAIL on missing workspace

- [ ] **Step 3: Implement** four components + constant in `pivot-bridge.ts`

- [ ] **Step 4: Run** contract for workspace paths — PASS; `npm run audit:max-loc`

- [ ] **Step 5: Commit** — skip unless asked

---

### Task 5: Page swap + parity docs + FE wave contracts

**Files:**
- Modify: `frontend/app/(dashboard)/reports/universal-bonuses/page.tsx`
- Modify: `frontend/tests/flat-report-page.m1.1.contract.test.ts` — remove universal-bonuses from FlatReport wave-4 polish assertions; add VP assertion like tasks
- Modify: `docs/superpowers/plans/2026-11-24-salesdoc-otchot-parity.md`
- Modify: `docs/superpowers/plans/2026-11-25-otchot-tezyuk-status-va-etirozlar.md`

**Interfaces:**
- Produces: default export renders `<UniversalBonusesVirtualPivotWorkspace />` only (no `FlatReportPage`)

- [ ] **Step 1: Update failing m1.1 / page contract** to require VP workspace and forbid FlatReportPage

- [ ] **Step 2: Run** — FAIL

- [ ] **Step 3: Rewrite `page.tsx`; fix parity status (#11 Virtual Pivot 2026-11-26; FlatReport polish done belgisi bekor)**

- [ ] **Step 4: Run**

```bash
cd frontend && npx vitest run tests/universal-bonuses-virtual-pivot.contract.test.ts tests/flat-report-page.m1.1.contract.test.ts
npm run lint:errors --prefix frontend
npm run audit:max-loc
cd backend && npx tsc -p tsconfig.json --noEmit
cd backend && npx vitest run tests/universal-bonuses-report.pure.test.ts
```

Expected: contracts PASS; lint:errors exit 0; audit OK; BE pure PASS.

- [ ] **Step 5: Commit** — skip unless asked

---

## Self-review notes

- Spec goals (dataset, flat default, filters without group_by/search, saved datasetId, #10 untouched, AKB skip) each map to Tasks 1–5.
- Review Focus items pinned: shipped COALESCE (T1), truncated (T1/T4), classic COUNT/SUM (T3), saved filter (T4), agent scope (T1).
- No commit required until user asks.
