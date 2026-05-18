/**
 * Domain: Dashboard (supervisor / sales / finance snapshot).
 * Boundary: route → filter parse + RBAC scope; servis → Prisma agregatlar + Redis cache (`DASHBOARD_CACHE_TTL`).
 * Bog‘liq: `dashboard.route.ts`, `recordDashboardPerf`, `docs/domain-boundary.md`.
 */
import { getSnapshotCache, setSnapshotCache, stableJsonStringify } from "./dashboard.cache";
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
  const snapshotKey = `tenant:${tenantId}:dashboard:sales:${stableJsonStringify(filters)}`;
  const cached = await getSnapshotCache<SalesDashboardSnapshot>(snapshotKey);
  if (cached) return cached;

  const from = new Date(`${filters.from}T00:00:00.000Z`);
  const to = new Date(`${filters.to}T23:59:59.999Z`);
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
