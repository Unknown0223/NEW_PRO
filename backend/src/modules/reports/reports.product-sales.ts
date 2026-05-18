import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { ORDER_STATUSES_OUTSTANDING_RECEIVABLE } from "../orders/order-status";

import { parseDateRange } from "./reports.shared";

/** ─── 3. Product Sales ─────────────────────────────────── */

export async function getProductSales(
  tenantId: number,
  from?: string,
  to?: string,
  limit = 20
): Promise<{
  data: Array<{
    product_id: number;
    product_name: string;
    sku: string;
    unit: string;
    total_qty: string;
    total_revenue: string;
    order_count: number;
  }>;
}> {
  const range = parseDateRange(from, to);
  const start = range.gte ?? new Date(Date.now() - 30 * 86400000);
  const end = range.lte ?? new Date();

  const rows = await prisma.$queryRaw<
    Array<{
      product_id: number;
      name: string;
      sku: string;
      unit: string;
      total_qty: Prisma.Decimal;
      total_revenue: Prisma.Decimal;
      order_count: bigint;
    }>
  >`
    SELECT
      p.id AS product_id,
      p.name,
      p.sku,
      p.unit,
      SUM(oi.qty)::numeric(15,3) AS total_qty,
      SUM(oi.total)::numeric(15,2) AS total_revenue,
      COUNT(DISTINCT o.id)::bigint AS order_count
    FROM order_items oi
    JOIN orders o ON o.id = oi.order_id
    JOIN products p ON p.id = oi.product_id
    WHERE o.tenant_id = ${tenantId}
      AND o.created_at >= ${start}
      AND o.created_at <= ${end}
      AND p.tenant_id = ${tenantId}
    GROUP BY p.id, p.name, p.sku, p.unit
    ORDER BY total_revenue DESC
    LIMIT ${limit}
  `;

  return {
    data: rows.map((r) => ({
      product_id: r.product_id,
      product_name: r.name,
      sku: r.sku,
      unit: r.unit,
      total_qty: String(r.total_qty),
      total_revenue: String(r.total_revenue),
      order_count: Number(r.order_count)
    }))
  };
}
