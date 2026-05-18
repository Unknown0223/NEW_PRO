import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { ClientSales4Filters, ReportActor } from "./client-sales-4.types";
import { buildOrderWhereSql4, productFilterSql4 } from "./client-sales-4.helpers";

export function cteBody(f: ClientSales4Filters, tenantId: number, actor?: ReportActor) {
  const whereSql = buildOrderWhereSql4(tenantId, f, actor);
  const itemSql = productFilterSql4(f);
  const hasItemFilter = Boolean(
    (f.category_ids && f.category_ids.length) || (f.brand_ids && f.brand_ids.length)
  );
  const clientHaving = f.only_with_value
    ? Prisma.sql`HAVING COALESCE(SUM(fo.amount), 0) > 0`
    : Prisma.empty;

  return { whereSql, itemSql, hasItemFilter, clientHaving };
}
