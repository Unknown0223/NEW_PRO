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

async function buildSalesCtx(tenantId: number, filters: SalesDashboardFilters): Promise<SalesSnapshotQueryCtx> {
  const from = new Date(`${filters.from}T00:00:00.000Z`);
  const to = new Date(`${filters.to}T23:59:59.999Z`);
  const territoryTerms = await resolveSalesTerritoryTerms(tenantId, filters.territory_ids);
  return {
    tenantId,
    filters,
    territoryTerms,
    salesScope: salesOrderScopeSql(tenantId, from, to, filters, territoryTerms, { forSales: true }),
    allScope: salesOrderScopeSql(tenantId, from, to, filters, territoryTerms, { forSales: false }),
    productFilter: salesProductJoinFilter("p", filters)
  };
}

export type SalesDashboardSummaryPayload = Pick<
  SalesDashboardSnapshot,
  "filters" | "total_sales_summary" | "payment_method_analytics" | "akb_okb_block" | "orders_refusals"
>;

export type SalesDashboardAnalyticsPayload = Pick<
  SalesDashboardSnapshot,
  | "filters"
  | "product_category_analytics"
  | "product_group_analytics"
  | "category_performance_table"
  | "sales_dynamics"
  | "refusal_reason_analytics"
>;

export type SalesDashboardBreakdownPayload = Pick<SalesDashboardSnapshot, "filters" | "territory_analytics" | "agent_analytics"> & {
  agent_total: number;
  page: number;
  limit: number;
};

export async function getSalesDashboardSummary(
  tenantId: number,
  filters: SalesDashboardFilters
): Promise<SalesDashboardSummaryPayload> {
  const snapshotKey = `tenant:${tenantId}:dashboard:sales:summary:${stableJsonStringify(filters)}`;
  const cached = await getSnapshotCache<SalesDashboardSummaryPayload>(snapshotKey);
  if (cached) return cached;

  const ctx = await buildSalesCtx(tenantId, filters);
  const productBlock = await fetchSalesSnapshotProductBlock(ctx);
  const ordersBlock = await fetchSalesSnapshotOrdersBlock(ctx);
  const coverageBlock = await fetchSalesSnapshotCoverageBlock(ctx, ordersBlock.akb);

  const result: SalesDashboardSummaryPayload = {
    filters,
    total_sales_summary: productBlock.total_sales_summary,
    payment_method_analytics: productBlock.payment_method_analytics,
    akb_okb_block: coverageBlock.akb_okb_block,
    orders_refusals: ordersBlock.orders_refusals
  };
  await setSnapshotCache(snapshotKey, result);
  return result;
}

export async function getSalesDashboardAnalytics(
  tenantId: number,
  filters: SalesDashboardFilters
): Promise<SalesDashboardAnalyticsPayload> {
  const snapshotKey = `tenant:${tenantId}:dashboard:sales:analytics:${stableJsonStringify(filters)}`;
  const cached = await getSnapshotCache<SalesDashboardAnalyticsPayload>(snapshotKey);
  if (cached) return cached;

  const ctx = await buildSalesCtx(tenantId, filters);
  const productBlock = await fetchSalesSnapshotProductBlock(ctx);
  const ordersBlock = await fetchSalesSnapshotOrdersBlock(ctx);

  const result: SalesDashboardAnalyticsPayload = {
    filters,
    product_category_analytics: productBlock.product_category_analytics,
    product_group_analytics: productBlock.product_group_analytics,
    category_performance_table: productBlock.category_performance_table,
    sales_dynamics: ordersBlock.sales_dynamics,
    refusal_reason_analytics: ordersBlock.refusal_reason_analytics
  };
  await setSnapshotCache(snapshotKey, result);
  return result;
}

export async function getSalesDashboardBreakdown(
  tenantId: number,
  filters: SalesDashboardFilters,
  opts: { page?: number; limit?: number } = {}
): Promise<SalesDashboardBreakdownPayload> {
  const page = Math.max(1, opts.page ?? 1);
  const limit = Math.min(200, Math.max(1, opts.limit ?? 50));
  const snapshotKey = `tenant:${tenantId}:dashboard:sales:breakdown:${stableJsonStringify({ filters, page, limit })}`;
  const cached = await getSnapshotCache<SalesDashboardBreakdownPayload>(snapshotKey);
  if (cached) return cached;

  const ctx = await buildSalesCtx(tenantId, filters);
  const ordersBlock = await fetchSalesSnapshotOrdersBlock(ctx);
  const coverageBlock = await fetchSalesSnapshotCoverageBlock(ctx, ordersBlock.akb);
  const offset = (page - 1) * limit;
  const agent_analytics = coverageBlock.agent_analytics.slice(offset, offset + limit);

  const result: SalesDashboardBreakdownPayload = {
    filters,
    territory_analytics: coverageBlock.territory_analytics,
    agent_analytics,
    agent_total: coverageBlock.agent_analytics.length,
    page,
    limit
  };
  await setSnapshotCache(snapshotKey, result);
  return result;
}
