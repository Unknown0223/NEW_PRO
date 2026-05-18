import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { clampPct, decToString } from "./dashboard.helpers";
import type { SalesMonitoringSnapshot } from "./sales-monitoring.types";
import type { SalesMonitoringBuildBase } from "./sales-monitoring.snapshot.base";

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
