import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dash = path.join(path.dirname(fileURLToPath(import.meta.url)), "../src/modules/dashboard");
const src = path.join(dash, "sales-monitoring.service.backup.ts");
const lines = fs.readFileSync(src, "utf8").split(/\r?\n/);
const slice = (a, b) => lines.slice(a - 1, b).join("\n");

const scopeBody = slice(81, 325)
  .replace(/^function clampPct[\s\S]*?^}\n\n/m, "")
  .replace(/^function decToString[\s\S]*?^}\n\n/m, "");

fs.writeFileSync(
  path.join(dash, "sales-monitoring.types.ts"),
  `${slice(45, 64)}

${slice(347, 431)}
`
);

fs.writeFileSync(
  path.join(dash, "sales-monitoring.scope.ts"),
  `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { SalesMonitoringFilters } from "./sales-monitoring.types";

const ORDER_STATUS_WHITELIST = new Set([
  "new",
  "confirmed",
  "picking",
  "delivering",
  "delivered",
  "cancelled",
  "returned"
]);

${scopeBody}
`
);

// Export scope symbols used elsewhere
let scope = fs.readFileSync(path.join(dash, "sales-monitoring.scope.ts"), "utf8");
for (const name of [
  "csvToBranchCodes",
  "csvToStringList",
  "sanitizeOrderStatuses",
  "monthBoundsUtc",
  "resolveSalesTerritoryTerms",
  "monitoringSalesScope",
  "monitoringOrdersScopeAllStatuses",
  "monitoringAllClientsScope"
]) {
  scope = scope.replace(new RegExp(`^function ${name}\\b`, "m"), `export function ${name}`);
}
scope = scope.replace(/^async function resolveSalesTerritoryTerms/m, "export async function resolveSalesTerritoryTerms");
fs.writeFileSync(path.join(dash, "sales-monitoring.scope.ts"), scope);

fs.writeFileSync(
  path.join(dash, "sales-monitoring.filters.ts"),
  `import { csvToIntArray, nonEmpty } from "./dashboard.helpers";
import type { SalesMonitoringFilters } from "./sales-monitoring.types";
import { csvToBranchCodes, csvToStringList, sanitizeOrderStatuses } from "./sales-monitoring.scope";

${slice(327, 345)}
`
);

const snapImports = `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { getSnapshotCache, setSnapshotCache, stableJsonStringify } from "./dashboard.cache";
import { clampPct, decToString } from "./dashboard.helpers";
import type { SalesMonitoringFilters, SalesMonitoringSnapshot } from "./sales-monitoring.types";
import {
  monthBoundsUtc,
  monitoringAllClientsScope,
  monitoringOrdersScopeAllStatuses,
  monitoringSalesScope,
  resolveSalesTerritoryTerms
} from "./sales-monitoring.scope";
`;

fs.writeFileSync(
  path.join(dash, "sales-monitoring.snapshot.base.ts"),
  `${snapImports}
import type { SalesMonitoringSnapshot } from "./sales-monitoring.types";

export type SalesMonitoringBuildBase = {
  tenantId: number;
  filters: SalesMonitoringFilters;
  fromYmd: string;
  toYmd: string;
  salesScope: ReturnType<typeof monitoringSalesScope> extends infer _T ? _T : never;
  allClientScope: ReturnType<typeof monitoringAllClientsScope> extends infer _T ? _T : never;
  skuScope: ReturnType<typeof monitoringOrdersScopeAllStatuses> extends infer _T ? _T : never;
  prevYearSalesScope: ReturnType<typeof monitoringSalesScope> extends infer _T ? _T : never;
  returnLossScope: ReturnType<typeof monitoringSalesScope> extends infer _T ? _T : never;
  factSales: string;
  curOrd: number;
  deliveredOrd: number;
  planSales: string;
  planNum: number;
  factNum: number;
  execution_pct: number | null;
  akb: number;
  okb: number;
  coverage_pct: number;
  growth_vs_prev_month_sales_pct: number | null;
  activeTerritoryKeys: number;
  returnLossSum: string;
  payment_method_options: string[];
  forecast_month_end_sales: string | null;
  aov: string;
  order_success_pct: number | null;
  branch_options: string[];
  agg0: { s: Prisma.Decimal; orders_count: bigint; delivered_orders: bigint } | undefined;
};

export async function buildSalesMonitoringBase(
  tenantId: number,
  filters: SalesMonitoringFilters
): Promise<SalesMonitoringBuildBase> {
${slice(441, 595)}
  return {
    tenantId,
    filters,
    fromYmd,
    toYmd,
    salesScope,
    allClientScope,
    skuScope,
    prevYearSalesScope,
    returnLossScope,
    factSales,
    curOrd,
    deliveredOrd,
    planSales,
    planNum,
    factNum,
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
    agg0
  };
}
`
);

fs.writeFileSync(
  path.join(dash, "sales-monitoring.snapshot.rest.ts"),
  `${snapImports}
import type { SalesMonitoringBuildBase } from "./sales-monitoring.snapshot.base";

export async function buildSalesMonitoringSnapshotRest(
  base: SalesMonitoringBuildBase
): Promise<SalesMonitoringSnapshot> {
  const {
    tenantId,
    filters,
    fromYmd,
    toYmd,
    salesScope,
    allClientScope,
    skuScope,
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
${slice(597, 994)}
}
`
);

fs.writeFileSync(
  path.join(dash, "sales-monitoring.snapshot.ts"),
  `${snapImports}
import { buildSalesMonitoringBase } from "./sales-monitoring.snapshot.base";
import { buildSalesMonitoringSnapshotRest } from "./sales-monitoring.snapshot.rest";

export async function getSalesMonitoringSnapshot(
  tenantId: number,
  filters: SalesMonitoringFilters
): Promise<SalesMonitoringSnapshot> {
  const snapshotKey = \`tenant:\${tenantId}:dashboard:sales-monitoring:\${stableJsonStringify(filters)}\`;
  const cached = await getSnapshotCache<SalesMonitoringSnapshot>(snapshotKey);
  if (cached) return cached;
  const base = await buildSalesMonitoringBase(tenantId, filters);
  const result = await buildSalesMonitoringSnapshotRest(base);
  await setSnapshotCache(snapshotKey, result);
  return result;
}
`
);

fs.writeFileSync(
  path.join(dash, "sales-monitoring.service.ts"),
  `/** Sales monitoring dashboard — barrel. */\nexport * from "./sales-monitoring.types";\nexport * from "./sales-monitoring.filters";\nexport * from "./sales-monitoring.snapshot";\n`
);

console.log("phase11 sales-monitoring split done");
