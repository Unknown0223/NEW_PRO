import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import type { ReportActor } from "../reports/client-sales-4-report.service";
import { REPORT_BUILDER_DATASET_ROW_CAP } from "./report-builder.constants";
import { REPORT_BUILDER_FIELD_IDS, fieldExprSql, listWdrFieldsForDataset } from "./report-builder.metadata";
import {
  buildReportBuilderWhereSql,
  REPORT_BUILDER_STATUS_LOGS_CTE,
  reportBuilderJoinSql,
  reportBuilderSafeFieldAlias
} from "./report-builder.query";
import type { ReportBuilderConfigPayload, ReportBuilderDatasetRequest, ReportBuilderDatasetResponse } from "./report-builder.types";

function parseUtcDayStart(ymd: string): Date {
  return new Date(`${ymd.slice(0, 10)}T00:00:00.000Z`);
}

function parseUtcDayEndExclusive(ymd: string): Date {
  const d = new Date(`${ymd.slice(0, 10)}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d;
}

function filtersToWhereConfig(filters: ReportBuilderDatasetRequest): ReportBuilderConfigPayload {
  return {
    datasetId: filters.datasetId,
    dateMode: filters.dateMode,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    agentIds: filters.agentIds,
    statuses: filters.statuses,
    orderTypes: filters.orderTypes,
    rowFieldIds: [],
    colFieldIds: [],
    metrics: { amount: true, qty: false, volume: false, akb: false },
    warehouseIds: filters.warehouseIds,
    productIds: filters.productIds,
    categoryIds: filters.categoryIds,
    productGroupIds: filters.productGroupIds,
    brandIds: filters.brandIds,
    expeditorUserIds: filters.expeditorUserIds,
    supervisorUserIds: filters.supervisorUserIds,
    tradeDirectionIds: filters.tradeDirectionIds,
    kpiGroupIds: filters.kpiGroupIds,
    clientIds: filters.clientIds,
    paymentMethodRefs: filters.paymentMethodRefs,
    priceTypeRefs: filters.priceTypeRefs,
    branchValues: filters.branchValues,
    clientCategoryValues: filters.clientCategoryValues,
    territoryLevel1Values: filters.territoryLevel1Values,
    territoryLevel2Values: filters.territoryLevel2Values,
    territoryLevel3Values: filters.territoryLevel3Values
  };
}

function dimensionSelectParts(): Prisma.Sql[] {
  return REPORT_BUILDER_FIELD_IDS.map((id) =>
    Prisma.sql`${fieldExprSql(id)} AS ${Prisma.raw(`"${reportBuilderSafeFieldAlias(id)}"`)}`
  );
}

/** Xom zakaz qatorlari (order_items) — WebDataRocks client-side pivot uchun. */
export async function runReportBuilderDataset(
  tenantId: number,
  filters: ReportBuilderDatasetRequest,
  actor?: ReportActor
): Promise<ReportBuilderDatasetResponse> {
  const cap = REPORT_BUILDER_DATASET_ROW_CAP;
  const whereCfg = filtersToWhereConfig(filters);
  const whereSql = buildReportBuilderWhereSql(tenantId, whereCfg, actor);
  const retailFrom = parseUtcDayStart(filters.dateFrom);
  const retailToExcl = parseUtcDayEndExclusive(filters.dateTo);

  const dimParts = dimensionSelectParts();
  const selectCore = Prisma.sql`${Prisma.join(
    [
      ...dimParts,
      Prisma.sql`oi.total::numeric(15,2) AS amount`,
      Prisma.sql`oi.qty::numeric(15,3) AS qty`,
      Prisma.sql`(oi.qty * COALESCE(p.volume_m3, 0::numeric))::numeric(18,6) AS volume`,
      Prisma.sql`oi.price::numeric(15,2) AS price`,
      Prisma.sql`(CASE WHEN oi.is_bonus THEN oi.total ELSE 0 END)::numeric(15,2) AS bonus_line_total`,
      Prisma.sql`o.bonus_sum::numeric(15,2) AS order_bonus_sum`,
      Prisma.sql`o.discount_sum::numeric(15,2) AS discount_sum`,
      Prisma.sql`COALESCE(cb.balance, 0::numeric)::numeric(15,2) AS client_balance`,
      Prisma.sql`(GREATEST(o.total_sum - COALESCE((SELECT SUM(pa.amount) FROM payment_allocations pa WHERE pa.order_id = o.id AND pa.tenant_id = o.tenant_id), 0::decimal), 0::decimal))::numeric(15,2) AS order_debt`,
      Prisma.sql`COALESCE(p.weight_kg, 0::numeric)::numeric(15,4) AS product_weight_kg`,
      Prisma.sql`o.client_id AS client_id`,
      Prisma.sql`(
        SELECT COALESCE(SUM(ros.quantity), 0::numeric)
        FROM retail_outlet_stocks ros
        WHERE ros.tenant_id = o.tenant_id
          AND ros.client_id = o.client_id
          AND ros.product_id = oi.product_id
          AND ros.stock_date >= ${retailFrom}
          AND ros.stock_date < ${retailToExcl}
      )::numeric(18,3) AS retail_stock_qty`,
      Prisma.sql`(
        SELECT COALESCE(SUM(ros.sold_quantity), 0::numeric)
        FROM retail_outlet_stocks ros
        WHERE ros.tenant_id = o.tenant_id
          AND ros.client_id = o.client_id
          AND ros.product_id = oi.product_id
          AND ros.stock_date >= ${retailFrom}
          AND ros.stock_date < ${retailToExcl}
      )::numeric(18,3) AS retail_stock_sold_qty`,
      Prisma.sql`(
        SELECT COALESCE(SUM(ros.amount), 0::numeric)
        FROM retail_outlet_stocks ros
        WHERE ros.tenant_id = o.tenant_id
          AND ros.client_id = o.client_id
          AND ros.product_id = oi.product_id
          AND ros.stock_date >= ${retailFrom}
          AND ros.stock_date < ${retailToExcl}
      )::numeric(18,2) AS retail_stock_amount`
    ],
    ", "
  )}`;

  const countRows = await prisma.$queryRaw<[{ cnt: bigint }]>`
    WITH ${REPORT_BUILDER_STATUS_LOGS_CTE}
    SELECT COUNT(*)::bigint AS cnt
    ${reportBuilderJoinSql(tenantId)}
    WHERE ${whereSql}
  `;

  const totalRowCount = Number(countRows[0]?.cnt ?? 0);

  const limit = cap + 1;
  const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
    WITH ${REPORT_BUILDER_STATUS_LOGS_CTE}
    SELECT
      ${selectCore}
    ${reportBuilderJoinSql(tenantId)}
    WHERE ${whereSql}
    ORDER BY o.id ASC, oi.id ASC
    LIMIT ${limit}
  `;

  const truncated = rows.length > cap;
  const dataRows = truncated ? rows.slice(0, cap) : rows;

  return {
    fields: listWdrFieldsForDataset(filters.datasetId),
    rows: dataRows,
    truncated,
    totalRowCount,
    cap
  };
}
