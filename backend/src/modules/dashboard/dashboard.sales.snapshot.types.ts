import type { Prisma } from "@prisma/client";
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
