import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const dash = fs.readFileSync(path.join(root, "../src/modules/dashboard/dashboard.sales.snapshot.backup.ts"), "utf8").split(/\r?\n/);
const sl = (a, b) => dash.slice(a - 1, b).join("\n");

const dh = `import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { clampPct } from "./dashboard.helpers";
import { buildSalesTerritoryAliasClause, salesDateExprByType } from "./dashboard.sales.scope";
import type { SalesSnapshotQueryCtx } from "./dashboard.sales.snapshot.types";
`;

const w = (name, body) => {
  fs.writeFileSync(path.join(root, `../src/modules/dashboard/${name}`), body.endsWith("\n") ? body : body + "\n");
};

w(
  "dashboard.sales.snapshot.types.ts",
  `import type { Prisma } from "@prisma/client";
import type { SalesDashboardFilters } from "./dashboard.sales.types";
import type { resolveSalesTerritoryTerms } from "./dashboard.sales.scope";

export type SalesSnapshotQueryCtx = {
  tenantId: number;
  filters: SalesDashboardFilters;
  salesScope: Prisma.Sql;
  allScope: Prisma.Sql;
  productFilter: Prisma.Sql;
  territoryTerms: Awaited<ReturnType<typeof resolveSalesTerritoryTerms>>;
};
`
);

w(
  "dashboard.sales.snapshot.products.ts",
  `${dh}
export async function fetchSalesSnapshotProductBlock(ctx: SalesSnapshotQueryCtx) {
  const { salesScope, productFilter } = ctx;
${sl(57, 174)}
  return {
    total_sales_summary: {
      total_sales_sum: totalSales.toString(),
      orders_count: Number(totalRow[0]?.orders_count ?? 0n)
    },
    payment_method_analytics,
    product_category_analytics,
    product_group_analytics,
    category_performance_table
  };
}
`
);

w(
  "dashboard.sales.snapshot.orders.ts",
  `${dh}
export async function fetchSalesSnapshotOrdersBlock(ctx: SalesSnapshotQueryCtx) {
  const { filters, salesScope, allScope, productFilter } = ctx;
${sl(176, 243)}
  return {
    orders_refusals,
    refusal_reason_analytics,
    sales_dynamics: sales_dynamics.map((r) => ({
      period: r.period,
      sales_sum: r.sales_sum.toString(),
      orders_count: Number(r.orders_count)
    })),
    akb: Number(akbRows[0]?.c ?? 0n)
  };
}
`
);

let cov = sl(245, 350).replace(/^\s*const akb = Number\(akbRows\[0\]\?\.c \?\? 0n\);\n/m, "");
w(
  "dashboard.sales.snapshot.coverage.ts",
  `${dh}
export async function fetchSalesSnapshotCoverageBlock(ctx: SalesSnapshotQueryCtx, akb: number) {
  const { tenantId, filters, salesScope, productFilter, territoryTerms } = ctx;
${cov}
  return {
    akb_okb_block: { akb, okb, coverage_pct: coverage },
    territory_analytics,
    agent_analytics
  };
}
`
);

w(
  "dashboard.sales.snapshot.ts",
  `${sl(1, 41)}
import type { SalesDashboardFilters, SalesDashboardSnapshot } from "./dashboard.sales.types";
import {
  resolveSalesTerritoryTerms,
  salesOrderScopeSql,
  salesProductJoinFilter
} from "./dashboard.sales.scope";
import type { SalesSnapshotQueryCtx } from "./dashboard.sales.snapshot.types";
import { fetchSalesSnapshotCoverageBlock } from "./dashboard.sales.snapshot.coverage";
import { fetchSalesSnapshotOrdersBlock } from "./dashboard.sales.snapshot.orders";
import { fetchSalesSnapshotProductBlock } from "./dashboard.sales.snapshot.products";

export async function getSalesDashboardSnapshot(
  tenantId: number,
  filters: SalesDashboardFilters
): Promise<SalesDashboardSnapshot> {
  const snapshotKey = \`tenant:\${tenantId}:dashboard:sales:\${stableJsonStringify(filters)}\`;
  const cached = await getSnapshotCache<SalesDashboardSnapshot>(snapshotKey);
  if (cached) return cached;

  const from = new Date(\`\${filters.from}T00:00:00.000Z\`);
  const to = new Date(\`\${filters.to}T23:59:59.999Z\`);
  const territoryTerms = await resolveSalesTerritoryTerms(tenantId, filters.territory_ids);
  const ctx: SalesSnapshotQueryCtx = {
    tenantId,
    filters,
    territoryTerms,
    salesScope: salesOrderScopeSql(tenantId, from, to, filters, territoryTerms, { forSales: true }),
    allScope: salesOrderScopeSql(tenantId, from, to, filters, territoryTerms, { forSales: false }),
    productFilter: salesProductJoinFilter("p", filters)
  };

  const productBlock = await fetchSalesSnapshotProductBlock(ctx);
  const ordersBlock = await fetchSalesSnapshotOrdersBlock(ctx);
  const coverageBlock = await fetchSalesSnapshotCoverageBlock(ctx, ordersBlock.akb);

  const result: SalesDashboardSnapshot = {
    filters,
    total_sales_summary: productBlock.total_sales_summary,
    payment_method_analytics: productBlock.payment_method_analytics,
    product_category_analytics: productBlock.product_category_analytics,
    product_group_analytics: productBlock.product_group_analytics,
    category_performance_table: productBlock.category_performance_table,
    orders_refusals: ordersBlock.orders_refusals,
    refusal_reason_analytics: ordersBlock.refusal_reason_analytics,
    sales_dynamics: ordersBlock.sales_dynamics,
    akb_okb_block: coverageBlock.akb_okb_block,
    territory_analytics: coverageBlock.territory_analytics,
    agent_analytics: coverageBlock.agent_analytics
  };
  await setSnapshotCache(snapshotKey, result);
  return result;
}
`
);

console.log("dashboard fixed");
