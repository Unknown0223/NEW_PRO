import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dash = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/dashboard");
const rest = fs.readFileSync(path.join(dash, "sales-monitoring.snapshot.rest.ts"), "utf8").split(/\r?\n/);
const slice = (a, b) => rest.slice(a - 1, b).join("\n");

const hdr = `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { clampPct, decToString } from "./dashboard.helpers";
import type { SalesMonitoringSnapshot } from "./sales-monitoring.types";
import type { SalesMonitoringBuildBase } from "./sales-monitoring.snapshot.base";
`;

fs.writeFileSync(
  path.join(dash, "sales-monitoring.snapshot.breakdown.ts"),
  `${hdr}
import type { SalesMonitoringBreakdownBlock } from "./sales-monitoring.snapshot.rest";

export async function buildSalesMonitoringBreakdown(
  base: SalesMonitoringBuildBase
): Promise<SalesMonitoringBreakdownBlock> {
  const { salesScope, allClientScope, filters } = base;
${slice(39, 261)}
  return {
    category_sales,
    product_group_sales,
    branch_performance,
    supervisor_performance,
    trade_directions,
    daily_sales,
    sales_channels
  };
}
`
);

fs.writeFileSync(
  path.join(dash, "sales-monitoring.snapshot.matrix.ts"),
  `${hdr}
import type { SalesMonitoringBreakdownBlock } from "./sales-monitoring.snapshot.rest";

export async function assembleSalesMonitoringSnapshot(
  base: SalesMonitoringBuildBase,
  breakdown: SalesMonitoringBreakdownBlock
): Promise<SalesMonitoringSnapshot> {
  const {
    filters,
    fromYmd,
    toYmd,
    salesScope,
    skuScope,
    prevYearSalesScope,
    factSales,
    curOrd,
    deliveredOrd,
    planSales,
    execution_pct,
    akb,
    okb,
    coverage_pct,
    growth_vs_prev_month_sales_pct,
    activeTerritoryKeys,
    returnLossSum,
    payment_method_options,
    forecast_month_end_sales,
    aov,
    order_success_pct,
    branch_options,
    agg0,
    factNum
  } = base;
  const {
    category_sales,
    product_group_sales,
    branch_performance,
    supervisor_performance,
    trade_directions,
    daily_sales,
    sales_channels
  } = breakdown;
${slice(263, 436)}
  return result;
}
`
);

fs.writeFileSync(
  path.join(dash, "sales-monitoring.snapshot.rest.ts"),
  `${hdr}
import { buildSalesMonitoringBreakdown } from "./sales-monitoring.snapshot.breakdown";
import { assembleSalesMonitoringSnapshot } from "./sales-monitoring.snapshot.matrix";

export type SalesMonitoringBreakdownBlock = Pick<
  SalesMonitoringSnapshot,
  | "category_sales"
  | "product_group_sales"
  | "branch_performance"
  | "supervisor_performance"
  | "trade_directions"
  | "daily_sales"
  | "sales_channels"
>;

export async function buildSalesMonitoringSnapshotRest(
  base: SalesMonitoringBuildBase
): Promise<SalesMonitoringSnapshot> {
  const breakdown = await buildSalesMonitoringBreakdown(base);
  return assembleSalesMonitoringSnapshot(base, breakdown);
}
`
);

console.log("phase12 snapshot.rest split done");
