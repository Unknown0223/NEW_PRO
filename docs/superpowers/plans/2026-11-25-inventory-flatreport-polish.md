# Inventory FlatReport polish (#7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `/reports/inventory` to FlatReport chrome parity (date radios, column prefs, address column, shipped COALESCE) with local seed so review is not empty.

**Architecture:** Keep thin `FlatReportPage` adapter. Extract `inventoryDateExpr` for COALESCE shipped/order dates. One-off SQL seed inserts `client_equipment` for aksit clients that already have orders. No dedicated workspace.

**Tech Stack:** Next.js FlatReport, Fastify/Prisma report modules, Vitest, PostgreSQL seed via `psql`/Prisma.

**Spec:** `docs/superpowers/specs/2026-11-25-inventory-flatreport-polish-design.md`

## Global Constraints

- Fayl ≤400 LOC (`npm run audit:max-loc`).
- Sifat: `npm run lint:errors --prefix frontend`; `cd backend && npx tsc -p tsconfig.json --noEmit`; `npm run audit:max-loc`.
- Picker labels: faqat nom (kod `searchText`da).
- Commit/deploy faqat user so‘raganda (commit qadamlari — skip by default).
- Доступ `reports.po_inventaryu` o‘zgartirilmaydi.

## Review Focus

- `date_type=shipped_date` with only `delivered_at` set → row still matches period (COALESCE).
- Clients with equipment but zero orders in range → still listed (`LEFT JOIN sales`).
- Removed equipment (`removed_at` set) → excluded from counts/types.
- FE still uses `FlatReportPage` (not a new workspace).
- Seed is tenant-scoped (aksit / tenant_id=3) and idempotent enough to re-run without duplicate spam (use fixed inventory_number prefix `INV-SEED-`).

---

### Task 1: BE shipped COALESCE + pure date expr

**Files:**
- Create: `backend/src/modules/reports/inventory.dates.ts`
- Modify: `backend/src/modules/reports/inventory.report.ts` (replace local `dateExpr`)
- Test: `backend/tests/inventory-report.pure.test.ts`

**Interfaces:**
- Consumes: `InventoryDateType` from `inventory.types.ts`
- Produces: `inventoryDateExpr(dateType: InventoryDateType): Prisma.Sql`
  - `order_date` → `o.created_at`
  - `shipped_date` → `COALESCE(sl.shipped_at, sl.delivered_at)`

- [ ] **Step 1: Write the failing test**

Add to `backend/tests/inventory-report.pure.test.ts`:

```ts
import { inventoryDateExpr } from "../src/modules/reports/inventory.dates";

it("shipped_date uses COALESCE shipped/delivered", () => {
  expect(inventoryDateExpr("shipped_date").strings.join("")).toMatch(/COALESCE/i);
  expect(inventoryDateExpr("shipped_date").strings.join("")).toMatch(/shipped_at/);
  expect(inventoryDateExpr("shipped_date").strings.join("")).toMatch(/delivered_at/);
});

it("order_date uses o.created_at", () => {
  expect(inventoryDateExpr("order_date").strings.join("")).toMatch(/created_at/);
});
```

(If Prisma.Sql shape differs, assert via `String(inventoryDateExpr(...))` containing the same tokens.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && npx vitest run tests/inventory-report.pure.test.ts`  
Expected: FAIL (module / export missing)

- [ ] **Step 3: Implement `inventoryDateExpr` and wire report**

Create `inventory.dates.ts` with the signature above. In `inventory.report.ts`, delete local `dateExpr` and call `inventoryDateExpr(f.date_type)`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && npx vitest run tests/inventory-report.pure.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit** — skip unless user asks

---

### Task 2: FE FlatReport chrome + contract

**Files:**
- Modify: `frontend/app/(dashboard)/reports/inventory/page.tsx`
- Create: `frontend/tests/inventory-flatreport.contract.test.ts`

**Interfaces:**
- Consumes: existing `FlatReportConfig` (`dateTypeAsRadio`, `tablePrefsId`, columns)
- Produces: page source containing:
  - `tablePrefsId: "report.inventory.v2"` (v2 resets prefs after address column insert)
  - `dateTypeAsRadio: true`
  - column key `address` with header `Адрес`
  - still `FlatReportPage`
  - `footerLeadColSpan` = lead columns before first numeric (after address insert: 8)

- [ ] **Step 1: Write the failing contract test**

```ts
// frontend/tests/inventory-flatreport.contract.test.ts
it("inventory page has prefs, date radios, address, FlatReportPage", () => {
  const src = readFileSync("app/(dashboard)/reports/inventory/page.tsx", "utf8");
  expect(src).toMatch(/FlatReportPage/);
  expect(src).toMatch(/tablePrefsId:\s*"report\.inventory"/);
  expect(src).toMatch(/dateTypeAsRadio:\s*true/);
  expect(src).toMatch(/key:\s*"address"/);
  expect(src).toMatch(/header:\s*"Адрес"/);
  expect(src).not.toMatch(/InventoryWorkspace|dedicated workspace/i);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx vitest run tests/inventory-flatreport.contract.test.ts`  
Expected: FAIL on missing prefs/address

- [ ] **Step 3: Update `page.tsx` config**

Add `tablePrefsId`, `dateTypeAsRadio`; insert `{ key: "address", header: "Адрес" }` after `phone`; set `footerLeadColSpan: 8`; keep `clientTableSearch.rowKeys` including `address`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npx vitest run tests/inventory-flatreport.contract.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit** — skip unless user asks

---

### Task 3: Seed + smoke + parity checklist

**Files:**
- Create: `backend/scripts/seed-inventory-report-demo.ts` (tsx one-off; tenant slug `aksit`)
- Modify: `docs/superpowers/plans/2026-11-24-salesdoc-otchot-parity.md` (#7 → done)
- Modify: `scripts/salesdoc/report-family-inventory.md` only if f-flags change (keep `ha`)

**Interfaces:**
- Consumes: Prisma `client` / `clientEquipment`; existing clients for tenant_id of slug `aksit`
- Produces: ≥3 active `client_equipment` rows with `inventory_number` like `INV-SEED-%` and types e.g. `Холодильник`, `Стелаж`; re-run deletes prior `INV-SEED-%` then inserts

- [ ] **Step 1: Implement seed script**

`seed-inventory-report-demo.ts`: resolve tenant by slug `aksit`; pick up to 5 clients; upsert/replace equipment with prefix `INV-SEED-`; log counts.

- [ ] **Step 2: Run seed**

Run: `cd backend && npx tsx scripts/seed-inventory-report-demo.ts`  
Expected: log `equipment_inserted >= 3`

- [ ] **Step 3: API smoke**

Login `admin`/`secret123` slug `aksit`;  
`GET /api/aksit/reports/inventory/filter-options` → 200, has `inventory_types`;  
`GET /api/aksit/reports/inventory?from=2026-01-01&to=2026-12-31&page=1&limit=20` → `total > 0`, rows include `address`;  
export endpoint 200 (same query + export path used by route).

- [ ] **Step 4: Quality gates**

```bash
npm run lint:errors --prefix frontend
cd backend && npx tsc -p tsconfig.json --noEmit
npm run audit:max-loc
```

Expected: all exit 0

- [ ] **Step 5: Mark #7 done in otchot parity plan**

In `docs/superpowers/plans/2026-11-24-salesdoc-otchot-parity.md`: set row 7 and Task 7 inventory checkbox to done with date 2026-11-25.

- [ ] **Step 6: Commit** — skip unless user asks

---

## Spec coverage (self-review)

| Spec goal | Task |
|-----------|------|
| FlatReport stays | 2 |
| dateTypeAsRadio + tablePrefsId | 2 |
| address column | 2 |
| shipped COALESCE | 1 |
| seed | 3 |
| smoke + gates | 3 |
| export address sync | already in `inventory.export.ts` — no change; smoke covers |
| #7 done marker | 3 |
