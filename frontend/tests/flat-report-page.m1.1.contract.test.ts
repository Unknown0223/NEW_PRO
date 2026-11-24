/**
 * ADR-010 M1.1–M1.3: FlatReportPage + wave-1 adapters + source-contract.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const frontendRoot = join(__dirname, "..");
const flatReportDir = join(frontendRoot, "components/reports/flat-report");
const wave1Adapters = [
  "app/(dashboard)/reports/discount-detail/page.tsx",
  "app/(dashboard)/reports/universal-discounts/page.tsx",
  "app/(dashboard)/reports/bonuses/page.tsx",
  "app/(dashboard)/reports/cumulative-bonus/page.tsx",
  "app/(dashboard)/reports/visits/page.tsx",
  "app/(dashboard)/reports/outlet-class/page.tsx"
] as const;

const wave3Adapters = [
  "app/(dashboard)/reports/sku-3/page.tsx",
  "app/(dashboard)/reports/order-qty/page.tsx",
  "app/(dashboard)/reports/inventory/page.tsx",
  "app/(dashboard)/reports/photo/page.tsx",
  "app/(dashboard)/reports/tasks/page.tsx",
  "app/(dashboard)/reports/sales-compare/page.tsx"
] as const;

const wave4Adapters = [
  "app/(dashboard)/reports/expeditor-share/page.tsx",
  "app/(dashboard)/reports/expeditor-visits/page.tsx",
  "app/(dashboard)/reports/expeditor-shipments/page.tsx",
  "app/(dashboard)/reports/universal-visits/page.tsx",
  "app/(dashboard)/reports/universal-bonuses/page.tsx",
  "app/(dashboard)/reports/universal-returns/page.tsx"
] as const;

const wave5Adapters = [
  "app/(dashboard)/reports/shelf-returns/page.tsx",
  "app/(dashboard)/reports/excel-export/page.tsx",
  "app/(dashboard)/reports/visits-2/page.tsx",
  "app/(dashboard)/reports/visit-totals/page.tsx",
  "app/(dashboard)/reports/client-sales-3/page.tsx"
] as const;

function readAdapter(rel: string): string {
  return readFileSync(join(frontendRoot, rel), "utf8");
}

describe("FlatReportPage wave-1 adapters + source-contract", () => {
  it("flat-report deep module files exist", () => {
    expect(existsSync(join(flatReportDir, "flat-report-page.tsx"))).toBe(true);
    expect(existsSync(join(flatReportDir, "types.ts"))).toBe(true);
    expect(existsSync(join(flatReportDir, "multi-filter.tsx"))).toBe(true);
  });

  it("types export expanded M1 filterKinds (not tor 3-kind)", () => {
    const src = readFileSync(join(flatReportDir, "types.ts"), "utf8");
    expect(src).toMatch(/"dateRange"/);
    expect(src).toMatch(/"search"/);
    expect(src).toMatch(/"multiSelect"/);
    expect(src).toMatch(/"select"/);
    expect(src).toMatch(/"bands"/);
    expect(src).toMatch(/clientTableSearch/);
    expect(src).toMatch(/FlatReportColumnsContext/);
    expect(src).toMatch(/showTableFooter/);
  });

  it("discount-orders-report-page.tsx is gone", () => {
    expect(existsSync(join(frontendRoot, "components/reports/discount-orders-report-page.tsx"))).toBe(
      false
    );
  });

  it("MultiFilter lives only in multi-filter.tsx", () => {
    const page = readFileSync(join(flatReportDir, "flat-report-page.tsx"), "utf8");
    const filters = readFileSync(join(flatReportDir, "flat-report-filters.tsx"), "utf8");
    expect(page).not.toMatch(/function MultiFilter/);
    expect(filters).not.toMatch(/function MultiFilter/);
    expect(filters).toMatch(/from ["']\.\/multi-filter["']/);
  });

  it("filter chrome uses FlatReportFilters + column prefs (not full-width stack)", () => {
    const page = readFileSync(join(flatReportDir, "flat-report-page.tsx"), "utf8");
    const filters = readFileSync(join(flatReportDir, "flat-report-filters.tsx"), "utf8");
    expect(existsSync(join(flatReportDir, "flat-report-filters.tsx"))).toBe(true);
    expect(page).toMatch(/FlatReportFilters/);
    expect(page).toMatch(/TableColumnSettingsDialog/);
    expect(page).toMatch(/useUserTablePrefs/);
    expect(filters).toMatch(/xl:grid-cols-9/);
    expect(filters).toMatch(/gridFields/);
    expect(filters).toMatch(/Дата применяется по/);
  });

  it.each(wave1Adapters)("%s is thin FlatReport adapter (M1.3)", (rel) => {
    const src = readAdapter(rel);
    expect(src).toMatch(/from ["']@\/components\/reports\/flat-report\/flat-report-page["']/);
    expect(src).toMatch(/FlatReportPage/);
    expect(src).not.toMatch(/emptyDraft/);
    expect(src).not.toMatch(/function MultiFilter/);
    expect(src).not.toMatch(/DiscountOrdersReportPage/);
    expect(src).not.toMatch(/useQuery/);
  });

  it("M1.2 adapters declare group_by / bands / clientTableSearch in config", () => {
    const bonuses = readAdapter("app/(dashboard)/reports/bonuses/page.tsx");
    expect(bonuses).toMatch(/paramKey:\s*["']group_by["']/);
    expect(bonuses).toMatch(/clientTableSearch/);
    expect(bonuses).toMatch(/columns:\s*\(\{\s*applied\s*\}\)/);

    const cumulative = readAdapter("app/(dashboard)/reports/cumulative-bonus/page.tsx");
    expect(cumulative).toMatch(/paramKey:\s*["']group_by["']/);
    expect(cumulative).toMatch(/clientTableSearch/);

    const visits = readAdapter("app/(dashboard)/reports/visits/page.tsx");
    expect(visits).toMatch(/clientTableSearch/);

    const outlet = readAdapter("app/(dashboard)/reports/outlet-class/page.tsx");
    expect(outlet).toMatch(/paramKey:\s*["']group_by["']/);
    expect(outlet).toMatch(/kind:\s*["']bands["']/);
    expect(outlet).toMatch(/clientTableSearch/);
  });

  it.each(wave3Adapters)("%s is thin FlatReport wave-3 adapter", (rel) => {
    const src = readAdapter(rel);
    expect(src).toMatch(/from ["']@\/components\/reports\/flat-report\/flat-report-page["']/);
    expect(src).toMatch(/FlatReportPage/);
    expect(src).not.toMatch(/emptyDraft/);
    expect(src).not.toMatch(/function MultiFilter/);
    expect(src).not.toMatch(/useQuery/);
  });

  it("wave-3 sales-compare dual dateRange + sku-3 valueFrom columns", () => {
    const compare = readAdapter("app/(dashboard)/reports/sales-compare/page.tsx");
    expect(compare).toMatch(/fromKey:\s*["']from_a["']/);
    expect(compare).toMatch(/fromKey:\s*["']from_b["']/);
    expect(compare).toMatch(/paramKey:\s*["']group_by["']/);

    const sku = readAdapter("app/(dashboard)/reports/sku-3/page.tsx");
    expect(sku).toMatch(/valueFrom:/);
    expect(sku).toMatch(/product_ids/);
    expect(sku).toMatch(/totalsKeys:\s*\[["']okb["'],\s*["']akb["']\]/);
  });

  it.each(wave4Adapters)("%s is thin FlatReport wave-4 adapter", (rel) => {
    const src = readAdapter(rel);
    expect(src).toMatch(/from ["']@\/components\/reports\/flat-report\/flat-report-page["']/);
    expect(src).toMatch(/FlatReportPage/);
    expect(src).not.toMatch(/emptyDraft/);
    expect(src).not.toMatch(/function MultiFilter/);
    expect(src).not.toMatch(/useQuery/);
  });

  it("wave-4 universal-bonuses group_by + expeditor-shipments valueFrom", () => {
    const bonuses = readAdapter("app/(dashboard)/reports/universal-bonuses/page.tsx");
    expect(bonuses).toMatch(/paramKey:\s*["']group_by["']/);
    expect(bonuses).toMatch(/columns:\s*\(\{\s*applied\s*\}\)/);
    expect(bonuses).toMatch(/clientTableSearch/);

    const shipments = readAdapter("app/(dashboard)/reports/expeditor-shipments/page.tsx");
    expect(shipments).toMatch(/valueFrom:/);
    expect(shipments).toMatch(/expeditor_ids/);
    expect(shipments).toMatch(/paramKey:\s*["']date_type["']/);
  });

  it.each(wave5Adapters)("%s is thin FlatReport wave-5 adapter", (rel) => {
    const src = readAdapter(rel);
    expect(src).toMatch(/from ["']@\/components\/reports\/flat-report\/flat-report-page["']/);
    expect(src).toMatch(/FlatReportPage/);
    expect(src).not.toMatch(/emptyDraft/);
    expect(src).not.toMatch(/function MultiFilter/);
    expect(src).not.toMatch(/useQuery/);
  });

  it("wave-5 client-sales-3 rowsKey + visit-totals today + visits-2 product_category_refs", () => {
    const cs3 = readAdapter("app/(dashboard)/reports/client-sales-3/page.tsx");
    expect(cs3).toMatch(/rowsKey:\s*["']clients["']/);
    expect(cs3).toMatch(/staticOptions/);

    const vt = readAdapter("app/(dashboard)/reports/visit-totals/page.tsx");
    expect(vt).toMatch(/defaultRange:\s*["']today["']/);
    expect(vt).toMatch(/order_statuses/);

    const v2 = readAdapter("app/(dashboard)/reports/visits-2/page.tsx");
    expect(v2).toMatch(/product_category_refs/);
  });
});
