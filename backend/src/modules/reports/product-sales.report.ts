import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES, ORDER_TYPES, ORDER_TYPE_LABELS } from "../orders/order-status";
import {
  paymentMethodStorageKey,
  priceTypeEntriesFromUnknown,
  priceTypeKey,
  resolveCurrencyEntries,
  resolvePaymentMethodEntries,
  resolvePaymentMethodRefToLabel
} from "../tenant-settings/finance-refs";
import type { ReportActor } from "./client-sales-4-report.service";
import type { ProductSalesReportFilters } from "./product-sales.types";
import { decStr, rowToDto, runProductAggCore, STATUS_CTE } from "./product-sales.agg";
import { buildOrderWhereSql, productFilterSql } from "./product-sales.where";
import { enrichScopedReportActor } from "../access/access-agent-scope";

export async function getProductSalesReport(
  tenantId: number,
  f: ProductSalesReportFilters,
  actor?: ReportActor
) {
  const scopedActor = actor ? await enrichScopedReportActor(tenantId, actor) : undefined;
  const offset = (f.page - 1) * f.limit;
  const { rows, total } = await runProductAggCore(tenantId, f, scopedActor, { offset, limit: f.limit });

  const totalsRow = await prisma.$queryRaw<
    Array<{
      qty: Prisma.Decimal;
      qty_bonus: Prisma.Decimal;
      volume_m3: Prisma.Decimal;
      total_revenue: Prisma.Decimal;
      bonus_total: Prisma.Decimal;
      akb: bigint;
      order_count: bigint;
      payments: Prisma.JsonValue;
    }>
  >`
    WITH ${STATUS_CTE},
    base AS (
      SELECT
        o.id AS order_id,
        o.client_id,
        oi.product_id,
        oi.id AS order_item_id,
        oi.qty,
        oi.total AS line_total,
        oi.is_bonus,
        p.name AS product_name,
        p.sku,
        p.sell_code,
        pc.name AS category_name,
        wb.name AS block_name,
        COALESCE(p.volume_m3, 0)::numeric(14,6) AS volume_unit
      FROM orders o
      JOIN clients c ON c.id = o.client_id
      LEFT JOIN users u ON u.id = COALESCE(o.agent_id, c.agent_id) AND u.tenant_id = ${tenantId}
      LEFT JOIN status_logs sl ON sl.order_id = o.id
      JOIN order_items oi ON oi.order_id = o.id
      JOIN products p ON p.id = oi.product_id AND p.tenant_id = ${tenantId}
      LEFT JOIN product_categories pc ON pc.id = p.category_id
      LEFT JOIN warehouse_blocks wb ON wb.id = o.warehouse_block_id
      WHERE ${buildOrderWhereSql(tenantId, f, scopedActor)}
        ${productFilterSql(f)}
    ),
    line_w AS (
      SELECT
        b.*,
        CASE
          WHEN SUM(b.line_total) OVER (PARTITION BY b.order_id) > 0 THEN
            (b.line_total::numeric / SUM(b.line_total) OVER (PARTITION BY b.order_id))
          ELSE
            (1.0::numeric / NULLIF(COUNT(*) OVER (PARTITION BY b.order_id), 0))
        END AS line_weight
      FROM base b
    ),
    pay_alloc AS (
      SELECT
        btrim(pay.payment_type) AS payment_type,
        SUM((pay.amount::numeric) * lw.line_weight)::numeric(15,2) AS amt
      FROM line_w lw
      JOIN client_payments pay ON pay.order_id = lw.order_id
        AND pay.tenant_id = ${tenantId}
        AND pay.deleted_at IS NULL
        AND pay.entry_kind = 'payment'
        AND pay.workflow_status = 'confirmed'
      GROUP BY btrim(pay.payment_type)
    ),
    pay_tot AS (
      SELECT COALESCE(jsonb_object_agg(payment_type, amt), '{}'::jsonb) AS payments FROM pay_alloc
    ),
    prod_lines AS (
      SELECT lw.client_id, lw.order_id, lw.qty, lw.line_total, lw.is_bonus, lw.volume_unit
      FROM line_w lw
    )
    SELECT
      COALESCE(SUM(pl.qty), 0)::numeric(15,3) AS qty,
      COALESCE(SUM(CASE WHEN pl.is_bonus THEN pl.qty ELSE 0 END), 0)::numeric(15,3) AS qty_bonus,
      COALESCE(SUM(pl.qty * pl.volume_unit), 0)::numeric(15,6) AS volume_m3,
      COALESCE(SUM(pl.line_total), 0)::numeric(15,2) AS total_revenue,
      COALESCE(SUM(CASE WHEN pl.is_bonus THEN pl.line_total ELSE 0 END), 0)::numeric(15,2) AS bonus_total,
      COUNT(DISTINCT pl.client_id)::bigint AS akb,
      COUNT(DISTINCT pl.order_id)::bigint AS order_count,
      (SELECT payments FROM pay_tot) AS payments
    FROM prod_lines pl
  `;

  const t = totalsRow[0];
  const totalsPayments: Record<string, string> = {};
  const tp = t?.payments;
  if (tp && typeof tp === "object" && !Array.isArray(tp)) {
    for (const [k, v] of Object.entries(tp as Record<string, unknown>)) {
      totalsPayments[k] = decStr(v as Prisma.Decimal);
    }
  }

  return {
    period_from: f.from,
    period_to: f.to,
    date_type: f.date_type,
    page: f.page,
    limit: f.limit,
    total: Number(total),
    totals: {
      qty: decStr(t?.qty),
      qty_bonus: decStr(t?.qty_bonus),
      volume_m3: decStr(t?.volume_m3),
      total: decStr(t?.total_revenue),
      bonus_total: decStr(t?.bonus_total),
      akb: t ? Number(t.akb) : 0,
      order_count: t ? Number(t.order_count) : 0,
      payments: totalsPayments
    },
    rows: rows.map((r, i) => rowToDto(r, i, f.page, f.limit))
  };
}
