import { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { fixed, ymdEnd, ymdStart } from "./stock.shared";
import type { MaterialReportOpts, MaterialReportRow } from "./stock.material-report.types";

export async function listMaterialReport(
  tenantId: number,
  opts: MaterialReportOpts
): Promise<{ data: MaterialReportRow[]; total: number; page: number; limit: number }> {
  const from = ymdStart(opts.date_from);
  const to = ymdEnd(opts.date_to);

  const whOrder = opts.warehouse_id != null ? Prisma.sql`AND o.warehouse_id = ${opts.warehouse_id}` : Prisma.sql``;
  const whGr = opts.warehouse_id != null ? Prisma.sql`AND gr.warehouse_id = ${opts.warehouse_id}` : Prisma.sql``;
  const whCorr = opts.warehouse_id != null ? Prisma.sql`AND wc.warehouse_id = ${opts.warehouse_id}` : Prisma.sql``;
  const whRet = opts.warehouse_id != null ? Prisma.sql`AND sr.warehouse_id = ${opts.warehouse_id}` : Prisma.sql``;
  const whTxSrc = opts.warehouse_id != null ? Prisma.sql`AND wt.source_warehouse_id = ${opts.warehouse_id}` : Prisma.sql``;
  const whTxDst = opts.warehouse_id != null ? Prisma.sql`AND wt.destination_warehouse_id = ${opts.warehouse_id}` : Prisma.sql``;
  const whSt = opts.warehouse_id != null ? Prisma.sql`AND st.warehouse_id = ${opts.warehouse_id}` : Prisma.sql``;
  const catFilter = opts.category_id != null ? Prisma.sql`AND p.category_id = ${opts.category_id}` : Prisma.sql``;
  const productFilter = opts.product_id != null ? Prisma.sql`AND p.id = ${opts.product_id}` : Prisma.sql``;
  const q = (opts.q ?? "").trim();
  const qFilter = q ? Prisma.sql`AND (p.name ILIKE ${`%${q}%`} OR p.sku ILIKE ${`%${q}%`})` : Prisma.sql``;

  const rows = await prisma.$queryRaw<Array<{
    product_id: number;
    sku: string;
    product_name: string;
    category_name: string | null;
    beginning_stock: number;
    incoming_receipt: number;
    correction_plus: number;
    return_from_shelf: number;
    inventory_plus: number;
    transfer_plus: number;
    partial_return: number;
    sale_out: number;
    supplier_return: number;
    correction_minus: number;
    bonus_out: number;
    writeoff_out: number;
    transfer_minus: number;
    inventory_minus: number;
    canceled_receipt: number;
    ending_stock: number;
    volume_m3: number;
  }>>`
    WITH movement AS (
      SELECT grl.product_id, COALESCE(gr.receipt_at, gr.created_at) AS at,
             SUM(grl.qty)::numeric AS incoming_receipt,
             0::numeric AS correction_plus, 0::numeric AS return_from_shelf, 0::numeric AS inventory_plus,
             0::numeric AS transfer_plus, 0::numeric AS partial_return, 0::numeric AS sale_out,
             0::numeric AS supplier_return, 0::numeric AS correction_minus, 0::numeric AS bonus_out,
             0::numeric AS writeoff_out, 0::numeric AS transfer_minus, 0::numeric AS inventory_minus,
             0::numeric AS canceled_receipt
      FROM goods_receipt_lines grl
      JOIN goods_receipts gr ON gr.id = grl.receipt_id
      WHERE gr.tenant_id = ${tenantId} AND gr.status = 'posted' ${whGr}
      GROUP BY grl.product_id, COALESCE(gr.receipt_at, gr.created_at)

      UNION ALL

      SELECT grl.product_id, COALESCE(gr.deleted_at, gr.updated_at, gr.created_at) AS at,
             0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric,
             0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric,
             SUM(grl.qty)::numeric
      FROM goods_receipt_lines grl
      JOIN goods_receipts gr ON gr.id = grl.receipt_id
      WHERE gr.tenant_id = ${tenantId} AND gr.status = 'cancelled' ${whGr}
      GROUP BY grl.product_id, COALESCE(gr.deleted_at, gr.updated_at, gr.created_at)

      UNION ALL

      SELECT wcl.product_id, wc.occurred_at AS at,
             0::numeric,
             SUM(CASE WHEN wc.kind = 'correction' AND wcl.qty_delta > 0 THEN wcl.qty_delta ELSE 0 END)::numeric,
             0::numeric,
             SUM(CASE WHEN wc.kind = 'inventory_count' AND wcl.qty_delta > 0 THEN wcl.qty_delta ELSE 0 END)::numeric,
             0::numeric, 0::numeric, 0::numeric, 0::numeric,
             SUM(CASE WHEN wc.kind = 'correction' AND wcl.qty_delta < 0 THEN ABS(wcl.qty_delta) ELSE 0 END)::numeric,
             0::numeric, 0::numeric, 0::numeric,
             SUM(CASE WHEN wc.kind = 'inventory_count' AND wcl.qty_delta < 0 THEN ABS(wcl.qty_delta) ELSE 0 END)::numeric,
             0::numeric
      FROM warehouse_correction_lines wcl
      JOIN warehouse_corrections wc ON wc.id = wcl.document_id
      WHERE wc.tenant_id = ${tenantId} ${whCorr}
      GROUP BY wcl.product_id, wc.occurred_at

      UNION ALL

      SELECT srl.product_id, sr.created_at AS at,
             0::numeric, 0::numeric,
             SUM(CASE WHEN COALESCE(sr.return_type, 'partial') <> 'partial' THEN srl.qty ELSE 0 END)::numeric,
             0::numeric, 0::numeric,
             SUM(CASE WHEN COALESCE(sr.return_type, 'partial') = 'partial' THEN srl.qty ELSE 0 END)::numeric,
             0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric
      FROM sales_return_lines srl
      JOIN sales_returns sr ON sr.id = srl.return_id
      WHERE sr.tenant_id = ${tenantId} AND sr.status = 'posted' ${whRet}
      GROUP BY srl.product_id, sr.created_at

      UNION ALL

      SELECT oi.product_id, o.created_at AS at,
             0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric,
             SUM(CASE WHEN oi.is_bonus = false THEN oi.qty ELSE 0 END)::numeric,
             0::numeric, 0::numeric,
             SUM(CASE WHEN oi.is_bonus = true THEN oi.qty ELSE 0 END)::numeric,
             0::numeric, 0::numeric, 0::numeric, 0::numeric
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE o.tenant_id = ${tenantId}
        AND o.order_type = 'order'
        AND o.status <> 'cancelled'
        ${whOrder}
      GROUP BY oi.product_id, o.created_at

      UNION ALL

      SELECT wtl.product_id, COALESCE(wt.received_at, wt.started_at, wt.created_at) AS at,
             0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric,
             0::numeric, 0::numeric, 0::numeric, 0::numeric,
             SUM(wtl.qty)::numeric, 0::numeric, 0::numeric
      FROM warehouse_transfer_lines wtl
      JOIN warehouse_transfers wt ON wt.id = wtl.transfer_id
      WHERE wt.tenant_id = ${tenantId} AND wt.status = 'received' ${whTxSrc}
      GROUP BY wtl.product_id, COALESCE(wt.received_at, wt.started_at, wt.created_at)

      UNION ALL

      SELECT wtl.product_id, COALESCE(wt.received_at, wt.started_at, wt.created_at) AS at,
             0::numeric, 0::numeric, 0::numeric, 0::numeric, SUM(wtl.qty)::numeric, 0::numeric, 0::numeric,
             0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric
      FROM warehouse_transfer_lines wtl
      JOIN warehouse_transfers wt ON wt.id = wtl.transfer_id
      WHERE wt.tenant_id = ${tenantId} AND wt.status = 'received' ${whTxDst}
      GROUP BY wtl.product_id, COALESCE(wt.received_at, wt.started_at, wt.created_at)

      UNION ALL

      SELECT stl.product_id, COALESCE(st.posted_at, st.updated_at, st.created_at) AS at,
             0::numeric, 0::numeric, 0::numeric,
             SUM(CASE WHEN stl.counted_qty IS NOT NULL AND stl.counted_qty - stl.system_qty > 0 THEN stl.counted_qty - stl.system_qty ELSE 0 END)::numeric,
             0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric, 0::numeric,
             SUM(CASE WHEN stl.counted_qty IS NOT NULL AND stl.counted_qty - stl.system_qty < 0 THEN ABS(stl.counted_qty - stl.system_qty) ELSE 0 END)::numeric,
             0::numeric
      FROM stock_take_lines stl
      JOIN stock_takes st ON st.id = stl.stock_take_id
      WHERE st.tenant_id = ${tenantId} AND st.status = 'posted' ${whSt}
      GROUP BY stl.product_id, COALESCE(st.posted_at, st.updated_at, st.created_at)
    ),
    agg AS (
      SELECT
        product_id,
        SUM(CASE WHEN at < ${from} THEN incoming_receipt + correction_plus + return_from_shelf + inventory_plus + transfer_plus + partial_return
                                     - sale_out - supplier_return - correction_minus - bonus_out - writeoff_out - transfer_minus - inventory_minus - canceled_receipt
                 ELSE 0 END)::numeric AS beginning_stock,
        SUM(CASE WHEN at >= ${from} AND at <= ${to} THEN incoming_receipt ELSE 0 END)::numeric AS incoming_receipt,
        SUM(CASE WHEN at >= ${from} AND at <= ${to} THEN correction_plus ELSE 0 END)::numeric AS correction_plus,
        SUM(CASE WHEN at >= ${from} AND at <= ${to} THEN return_from_shelf ELSE 0 END)::numeric AS return_from_shelf,
        SUM(CASE WHEN at >= ${from} AND at <= ${to} THEN inventory_plus ELSE 0 END)::numeric AS inventory_plus,
        SUM(CASE WHEN at >= ${from} AND at <= ${to} THEN transfer_plus ELSE 0 END)::numeric AS transfer_plus,
        SUM(CASE WHEN at >= ${from} AND at <= ${to} THEN partial_return ELSE 0 END)::numeric AS partial_return,
        SUM(CASE WHEN at >= ${from} AND at <= ${to} THEN sale_out ELSE 0 END)::numeric AS sale_out,
        SUM(CASE WHEN at >= ${from} AND at <= ${to} THEN supplier_return ELSE 0 END)::numeric AS supplier_return,
        SUM(CASE WHEN at >= ${from} AND at <= ${to} THEN correction_minus ELSE 0 END)::numeric AS correction_minus,
        SUM(CASE WHEN at >= ${from} AND at <= ${to} THEN bonus_out ELSE 0 END)::numeric AS bonus_out,
        SUM(CASE WHEN at >= ${from} AND at <= ${to} THEN writeoff_out ELSE 0 END)::numeric AS writeoff_out,
        SUM(CASE WHEN at >= ${from} AND at <= ${to} THEN transfer_minus ELSE 0 END)::numeric AS transfer_minus,
        SUM(CASE WHEN at >= ${from} AND at <= ${to} THEN inventory_minus ELSE 0 END)::numeric AS inventory_minus,
        SUM(CASE WHEN at >= ${from} AND at <= ${to} THEN canceled_receipt ELSE 0 END)::numeric AS canceled_receipt
      FROM movement
      GROUP BY product_id
    )
    SELECT
      p.id AS product_id,
      p.sku,
      p.name AS product_name,
      pc.name AS category_name,
      COALESCE(a.beginning_stock, 0)::float8 AS beginning_stock,
      COALESCE(a.incoming_receipt, 0)::float8 AS incoming_receipt,
      COALESCE(a.correction_plus, 0)::float8 AS correction_plus,
      COALESCE(a.return_from_shelf, 0)::float8 AS return_from_shelf,
      COALESCE(a.inventory_plus, 0)::float8 AS inventory_plus,
      COALESCE(a.transfer_plus, 0)::float8 AS transfer_plus,
      COALESCE(a.partial_return, 0)::float8 AS partial_return,
      COALESCE(a.sale_out, 0)::float8 AS sale_out,
      COALESCE(a.supplier_return, 0)::float8 AS supplier_return,
      COALESCE(a.correction_minus, 0)::float8 AS correction_minus,
      COALESCE(a.bonus_out, 0)::float8 AS bonus_out,
      COALESCE(a.writeoff_out, 0)::float8 AS writeoff_out,
      COALESCE(a.transfer_minus, 0)::float8 AS transfer_minus,
      COALESCE(a.inventory_minus, 0)::float8 AS inventory_minus,
      COALESCE(a.canceled_receipt, 0)::float8 AS canceled_receipt,
      (
        COALESCE(a.beginning_stock, 0) +
        COALESCE(a.incoming_receipt, 0) +
        COALESCE(a.correction_plus, 0) +
        COALESCE(a.return_from_shelf, 0) +
        COALESCE(a.inventory_plus, 0) +
        COALESCE(a.transfer_plus, 0) +
        COALESCE(a.partial_return, 0) -
        COALESCE(a.sale_out, 0) -
        COALESCE(a.supplier_return, 0) -
        COALESCE(a.correction_minus, 0) -
        COALESCE(a.bonus_out, 0) -
        COALESCE(a.writeoff_out, 0) -
        COALESCE(a.transfer_minus, 0) -
        COALESCE(a.inventory_minus, 0) -
        COALESCE(a.canceled_receipt, 0)
      )::float8 AS ending_stock,
      COALESCE(p.volume_m3, 0)::float8 AS volume_m3
    FROM products p
    LEFT JOIN product_categories pc ON pc.id = p.category_id
    LEFT JOIN agg a ON a.product_id = p.id
    WHERE p.tenant_id = ${tenantId}
      ${catFilter}
      ${productFilter}
      ${qFilter}
      AND (
        COALESCE(a.beginning_stock, 0) <> 0 OR COALESCE(a.incoming_receipt, 0) <> 0 OR
        COALESCE(a.correction_plus, 0) <> 0 OR COALESCE(a.return_from_shelf, 0) <> 0 OR
        COALESCE(a.inventory_plus, 0) <> 0 OR COALESCE(a.transfer_plus, 0) <> 0 OR
        COALESCE(a.partial_return, 0) <> 0 OR COALESCE(a.sale_out, 0) <> 0 OR
        COALESCE(a.correction_minus, 0) <> 0 OR COALESCE(a.bonus_out, 0) <> 0 OR
        COALESCE(a.transfer_minus, 0) <> 0 OR COALESCE(a.inventory_minus, 0) <> 0 OR
        COALESCE(a.canceled_receipt, 0) <> 0
      )
    ORDER BY p.name ASC
  `;

  let mapped = rows.map((r) => ({
    product_id: r.product_id,
    sku: r.sku,
    product_name: r.product_name,
    category_name: r.category_name,
    beginning_stock: fixed(r.beginning_stock, 3),
    incoming_receipt: fixed(r.incoming_receipt, 3),
    correction_plus: fixed(r.correction_plus, 3),
    return_from_shelf: fixed(r.return_from_shelf, 3),
    inventory_plus: fixed(r.inventory_plus, 3),
    transfer_plus: fixed(r.transfer_plus, 3),
    partial_return: fixed(r.partial_return, 3),
    sale_out: fixed(r.sale_out, 3),
    supplier_return: fixed(r.supplier_return, 3),
    correction_minus: fixed(r.correction_minus, 3),
    bonus_out: fixed(r.bonus_out, 3),
    writeoff_out: fixed(r.writeoff_out, 3),
    transfer_minus: fixed(r.transfer_minus, 3),
    inventory_minus: fixed(r.inventory_minus, 3),
    canceled_receipt: fixed(r.canceled_receipt, 3),
    ending_stock: fixed(r.ending_stock, 3),
    volume_m3: fixed(r.volume_m3, 6)
  }));

  if (opts.qty_mode === "positive") mapped = mapped.filter((r) => Number(r.ending_stock) > 0);
  else if (opts.qty_mode === "zero") mapped = mapped.filter((r) => Number(r.ending_stock) === 0);

  const total = mapped.length;
  const offset = (opts.page - 1) * opts.limit;
  return { data: mapped.slice(offset, offset + opts.limit), total, page: opts.page, limit: opts.limit };
}
