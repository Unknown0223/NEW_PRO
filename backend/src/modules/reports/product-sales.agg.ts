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
import {
  buildOrderWhereSql,
  productFilterSql,
  sortOrderSql
} from "./product-sales.where";

export const STATUS_CTE = Prisma.sql`
  status_logs AS (
    SELECT
      sl.order_id,
      MIN(CASE WHEN sl.to_status = 'delivering' THEN sl.created_at END) AS shipped_at,
      MIN(CASE WHEN sl.to_status = 'delivered' THEN sl.created_at END) AS delivered_at
    FROM order_status_logs sl
    GROUP BY sl.order_id
  )`;

export function decStr(v: Prisma.Decimal | null | undefined): string {
  if (v == null) return "0";
  return String(v);
}

export type RowRaw = {
  product_id: number;
  product_name: string;
  sku: string;
  sell_code: string | null;
  category_name: string | null;
  block_names: string | null;
  qty: Prisma.Decimal;
  qty_bonus: Prisma.Decimal;
  volume_m3: Prisma.Decimal;
  total_revenue: Prisma.Decimal;
  bonus_total: Prisma.Decimal;
  akb: bigint;
  order_count: bigint;
  payments: Prisma.JsonValue;
};

export async function runProductAggCore(
  tenantId: number,
  f: ProductSalesReportFilters,
  actor: ReportActor | undefined,
  opts: { offset: number; limit: number | null }
): Promise<{ rows: RowRaw[]; total: bigint }> {
  const whereSql = buildOrderWhereSql(tenantId, f, actor);
  const pSql = productFilterSql(f);
  const orderSql = sortOrderSql(f.sort_by);
  const offset = opts.offset;

  const countRows = await prisma.$queryRaw<Array<{ total: bigint }>>`
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
      WHERE ${whereSql}
        ${pSql}
    ),
    prod_keys AS (SELECT DISTINCT b.product_id FROM base b)
    SELECT COUNT(*)::bigint AS total FROM prod_keys
  `;
  const total = countRows[0]?.total ?? BigInt(0);

  const limitSql =
    opts.limit != null ? Prisma.sql`LIMIT ${opts.limit} OFFSET ${offset}` : Prisma.empty;

  const rows = await prisma.$queryRaw<RowRaw[]>`
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
      WHERE ${whereSql}
        ${pSql}
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
        lw.product_id,
        btrim(pay.payment_type) AS payment_type,
        SUM((pay.amount::numeric) * lw.line_weight)::numeric(15,2) AS amt
      FROM line_w lw
      JOIN client_payments pay ON pay.order_id = lw.order_id
        AND pay.tenant_id = ${tenantId}
        AND pay.deleted_at IS NULL
        AND pay.entry_kind = 'payment'
        AND pay.workflow_status = 'confirmed'
      GROUP BY lw.product_id, btrim(pay.payment_type)
    ),
    pay_json AS (
      SELECT product_id, jsonb_object_agg(payment_type, amt) AS payments
      FROM pay_alloc
      GROUP BY product_id
    ),
    prod_agg AS (
      SELECT
        lw.product_id,
        MAX(lw.product_name) AS product_name,
        MAX(lw.sku) AS sku,
        MAX(lw.sell_code) AS sell_code,
        MAX(lw.category_name) AS category_name,
        string_agg(DISTINCT NULLIF(trim(lw.block_name), ''), ', ') AS block_names,
        SUM(lw.qty)::numeric(15,3) AS qty,
        SUM(CASE WHEN lw.is_bonus THEN lw.qty ELSE 0 END)::numeric(15,3) AS qty_bonus,
        SUM(lw.qty * lw.volume_unit)::numeric(15,6) AS volume_m3,
        SUM(lw.line_total)::numeric(15,2) AS total_revenue,
        SUM(CASE WHEN lw.is_bonus THEN lw.line_total ELSE 0 END)::numeric(15,2) AS bonus_total,
        COUNT(DISTINCT lw.client_id)::bigint AS akb,
        COUNT(DISTINCT lw.order_id)::bigint AS order_count
      FROM line_w lw
      GROUP BY lw.product_id
    )
    SELECT
      pa.product_id,
      pa.product_name,
      pa.sku,
      pa.sell_code,
      pa.category_name,
      pa.block_names,
      pa.qty,
      pa.qty_bonus,
      pa.volume_m3,
      pa.total_revenue,
      pa.bonus_total,
      pa.akb,
      pa.order_count,
      COALESCE(pj.payments, '{}'::jsonb) AS payments
    FROM prod_agg pa
    LEFT JOIN pay_json pj ON pj.product_id = pa.product_id
    ORDER BY ${orderSql}
    ${limitSql}
  `;

  return { rows, total };
}

export function rowToDto(r: RowRaw, idx: number, page: number, limit: number) {
  const payments =
    r.payments && typeof r.payments === "object" && !Array.isArray(r.payments)
      ? (r.payments as Record<string, unknown>)
      : {};
  const payOut: Record<string, string> = {};
  for (const [k, v] of Object.entries(payments)) {
    payOut[k] = decStr(v as Prisma.Decimal);
  }
  return {
    row_number: (page - 1) * limit + idx + 1,
    product_id: r.product_id,
    name: r.product_name,
    sku: r.sku,
    sell_code: r.sell_code ?? "",
    category_name: r.category_name ?? "",
    block: r.block_names ?? "",
    qty: decStr(r.qty),
    qty_bonus: decStr(r.qty_bonus),
    volume_m3: decStr(r.volume_m3),
    total: decStr(r.total_revenue),
    bonus_total: decStr(r.bonus_total),
    akb: Number(r.akb),
    order_count: Number(r.order_count),
    payments: payOut
  };
}
